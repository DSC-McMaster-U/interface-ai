import json
import threading
from typing import Any, Callable

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from app.langgraph.utilities import (
    content_to_text,
    invoke_with_retry,
    parse_verdict_json,
)


def run_architecture_1(
    *,
    api_key: str,
    goal: str,
    max_steps: int,
    emit: Callable[[str], None],
    approved_send: Callable[[str, dict[str, Any] | None], dict[str, Any]],
    stop_event: threading.Event,
) -> None:
    @tool
    def goto(url: str) -> dict[str, Any]:
        """Navigate current tab to url."""
        return approved_send("goto", {"url": url})

    @tool
    def clickByName(name: str, exactMatch: bool = False) -> dict[str, Any]:
        """Click element by visible text."""
        return approved_send("clickByName", {"name": name, "exactMatch": exactMatch})

    @tool
    def fillInput(identifier: str, value: str) -> dict[str, Any]:
        """Fill input field by identifier with value."""
        return approved_send("fillInput", {"identifier": identifier, "value": value})

    @tool
    def pressEnter() -> dict[str, Any]:
        """Press Enter key in active element."""
        return approved_send("pressEnter", {})

    @tool
    def scrollDown(pixels: int = 500) -> dict[str, Any]:
        """Scroll down by pixels."""
        return approved_send("scrollDown", {"pixels": pixels})

    @tool
    def scrollUp(pixels: int = 500) -> dict[str, Any]:
        """Scroll up by pixels."""
        return approved_send("scrollUp", {"pixels": pixels})

    @tool
    def scrollToTop() -> dict[str, Any]:
        """Scroll to top."""
        return approved_send("scrollToTop", {})

    @tool
    def scrollToBottom() -> dict[str, Any]:
        """Scroll to bottom."""
        return approved_send("scrollToBottom", {})

    @tool
    def goBack() -> dict[str, Any]:
        """Navigate back in history."""
        return approved_send("goBack", {})

    @tool
    def goForward() -> dict[str, Any]:
        """Navigate forward in history."""
        return approved_send("goForward", {})

    @tool
    def getPageStatus() -> dict[str, Any]:
        """Get page snapshot (url/title/elements)."""
        return approved_send("getPageStatus", {})

    @tool
    def clickFirstSearchResult() -> dict[str, Any]:
        """Click first search result on results page."""
        return approved_send("clickFirstSearchResult", {})

    @tool
    def pressKey(key: str) -> dict[str, Any]:
        """Press keyboard key (Tab/Escape/ArrowDown/etc)."""
        return approved_send("pressKey", {"key": key})

    @tool
    def typeText(text: str) -> dict[str, Any]:
        """Type text into active element."""
        return approved_send("typeText", {"text": text})

    @tool
    def selectOption(identifier: str, value: str) -> dict[str, Any]:
        """Select a dropdown option by field identifier and option text/value."""
        return approved_send("selectOption", {"identifier": identifier, "value": value})

    @tool
    def clickFileInput(identifier: str) -> dict[str, Any]:
        """Open file picker by file input identifier."""
        return approved_send("clickFileInput", {"identifier": identifier})

    tools = [
        goto,
        clickByName,
        fillInput,
        pressEnter,
        scrollDown,
        scrollUp,
        scrollToTop,
        scrollToBottom,
        goBack,
        goForward,
        getPageStatus,
        clickFirstSearchResult,
        pressKey,
        typeText,
        selectOption,
        clickFileInput,
    ]

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.2,
    )
    agent = create_react_agent(model=model, tools=tools)

    initial_status = approved_send("getPageStatus", {})
    context = json.dumps(initial_status)[:6000]

    messages: list[BaseMessage] = [
        SystemMessage(
            content=(
                "You are a browser automation agent. Use tools to complete the goal. "
                "Call one tool at a time. If a tool fails, you must try a different approach. "
                "Use getPageStatus often; it includes dropdowns (selects) and file inputs when present. "
                "Do not say done until completion is verified from getPageStatus."
                "Always continue going and calling tools until the goal is complete, dont just stop midway. Be persistent and try different approaches if you fail."
            )
        ),
        HumanMessage(content=f"Goal: {goal}"),
        HumanMessage(content=f"Initial page status: {context}"),
    ]

    remaining_attempts = max_steps
    last_agent_text = ""

    while remaining_attempts > 0 and not stop_event.is_set():
        latest_messages = messages

        stream_succeeded = False
        stream_error: Exception | None = None
        for stream_attempt in range(3):
            try:
                for i, state in enumerate(
                    agent.stream({"messages": messages}, stream_mode="values"), start=1
                ):
                    latest_messages = state.get("messages") or latest_messages
                    last = latest_messages[-1] if latest_messages else None
                    if isinstance(last, AIMessage):
                        text = content_to_text(last.content)
                        if text:
                            last_agent_text = text
                            emit(f"Agent: {text}")
                    # Limit one agent pass to a reasonable number of state updates.
                    if i >= 25 or stop_event.is_set():
                        break
                stream_succeeded = True
                break
            except Exception as exc:
                stream_error = exc
                emit(
                    f"Transient model error during planning: {type(exc).__name__}: {exc}"
                )
                import time

                time.sleep(0.75 * (stream_attempt + 1))
        if not stream_succeeded:
            emit(
                f"Could not continue planning this pass: {type(stream_error).__name__}: {stream_error}"
            )

        remaining_attempts -= 1
        messages = latest_messages

        if stop_event.is_set():
            break

        verify_status = approved_send("getPageStatus", {})
        verify_context = json.dumps(verify_status)[:6000]

        verdict = invoke_with_retry(
            model,
            [
                SystemMessage(
                    content=(
                        "Decide if the user's browser task is complete based only on goal and page status. "
                        "Be strict and conservative: done=true only when the goal outcome is clearly achieved. "
                        "Respond as strict JSON only: "
                        '{"done": true|false, "reason": "...", "next_step_hint": "..."}.'
                    )
                ),
                HumanMessage(
                    content=f"Goal: {goal}\nLatest page status JSON: {verify_context}"
                ),
            ],
        )
        verdict_text = content_to_text(getattr(verdict, "content", ""))
        done = False
        reason = "Unknown reason"
        next_step_hint = "Try a different action based on the current page status."
        try:
            parsed = parse_verdict_json(verdict_text)
            done = bool(parsed.get("done", False))
            reason = str(parsed.get("reason", reason))
            next_step_hint = str(parsed.get("next_step_hint", next_step_hint))
        except Exception:
            done = '"done": true' in verdict_text.lower()
            reason = verdict_text[:300] if verdict_text else reason

        if done:
            emit(f"Done. Completed overall task: {goal}")
            emit(f"Completion reason: {reason}")
            return

        messages = [
            *messages,
            HumanMessage(
                content=(
                    f"Task is not complete yet. Reason: {reason}. "
                    f"Suggested next direction: {next_step_hint}. "
                    "Try a different approach and continue."
                )
            ),
        ]
        emit(f"Goal not complete yet: {reason}")

    if stop_event.is_set():
        emit("Agent stopped.")
    elif last_agent_text:
        emit(f"Stopped before completion. Last agent update: {last_agent_text}")
    else:
        emit("Stopped before completion.")
