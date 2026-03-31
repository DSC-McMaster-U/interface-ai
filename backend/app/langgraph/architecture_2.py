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


def _status_summary(status: dict[str, Any]) -> str:
    if not isinstance(status, dict):
        return json.dumps(status, ensure_ascii=True)[:4000]

    summary = {
        "title": status.get("title"),
        "url": status.get("url"),
        "scroll": status.get("scroll"),
        "buttons": [
            button.get("text")
            for button in status.get("buttons", [])[:10]
            if isinstance(button, dict) and button.get("text")
        ],
        "fillable_fields": [
            field.get("name")
            for field in status.get("fillableFields", [])[:10]
            if isinstance(field, dict) and field.get("name")
        ],
        "search_boxes": [
            field.get("name")
            for field in status.get("searchBoxes", [])[:5]
            if isinstance(field, dict) and field.get("name")
        ],
        "selects": [
            field.get("name")
            for field in status.get("selects", [])[:5]
            if isinstance(field, dict) and field.get("name")
        ],
        "links": [
            link.get("text")
            for link in status.get("links", [])[:8]
            if isinstance(link, dict) and link.get("text")
        ],
    }
    return json.dumps(summary, ensure_ascii=True)[:4000]


def _status_signature(status: dict[str, Any]) -> str:
    if not isinstance(status, dict):
        return str(status)

    signature = {
        "title": status.get("title"),
        "url": status.get("url"),
        "scroll": (status.get("scroll") or {}).get("percent"),
        "buttons": [
            button.get("text")
            for button in status.get("buttons", [])[:6]
            if isinstance(button, dict)
        ],
        "fillable_fields": [
            field.get("name")
            for field in status.get("fillableFields", [])[:6]
            if isinstance(field, dict)
        ],
    }
    return json.dumps(signature, sort_keys=True, ensure_ascii=True)


def run_architecture_2(
    *,
    api_key: str,
    goal: str,
    max_steps: int,
    emit: Callable[[str], None],
    approved_send: Callable[[str, dict[str, Any] | None], dict[str, Any]],
    request_user_input: Callable[..., dict[str, Any]],
    get_runtime_feedback: Callable[[], list[str]],
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

    @tool
    def requestUserInput(
        question: str, fieldKey: str, reason: str = ""
    ) -> dict[str, Any]:
        """Ask the user for task-critical missing information and wait for their answer."""
        return request_user_input(
            question,
            field_key=fieldKey,
            reason=reason,
        )

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
        requestUserInput,
    ]

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.2,
    )
    agent = create_react_agent(model=model, tools=tools)

    initial_status = approved_send("getPageStatus", {})
    messages: list[BaseMessage] = [
        SystemMessage(
            content=(
                "You are a browser automation agent. Prefer direct navigation when the goal "
                "mentions a specific website. Use getPageStatus before interacting with an "
                "unfamiliar page. Call exactly one tool at a time. If a tool fails or the "
                "page does not change, switch to a materially different action. Only stop "
                "when the goal is visibly complete. Use requestUserInput only for task-critical "
                "missing user-specific information or a critical choice that cannot be inferred."
            )
        ),
        HumanMessage(content=f"Goal: {goal}"),
        HumanMessage(content=f"Initial page summary: {_status_summary(initial_status)}"),
    ]

    remaining_attempts = max_steps
    last_agent_text = ""
    last_signature = _status_signature(initial_status)
    stagnant_checks = 0

    while remaining_attempts > 0 and not stop_event.is_set():
        runtime_feedback = get_runtime_feedback()
        if runtime_feedback:
            for feedback in runtime_feedback:
                messages = [
                    *messages,
                    HumanMessage(
                        content=(
                            f"Goal: {goal}\n"
                            f"FEEDBACK: {feedback}\n"
                            "Replan from the current page using this updated direction."
                        )
                    ),
                ]
                emit(f"Runtime feedback received: {feedback}")

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
                        if text and text != last_agent_text:
                            last_agent_text = text
                            emit(f"Agent: {text}")
                    if i >= 20 or stop_event.is_set():
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
        verify_summary = _status_summary(verify_status)
        verify_signature = _status_signature(verify_status)
        if verify_signature == last_signature:
            stagnant_checks += 1
        else:
            stagnant_checks = 0
        last_signature = verify_signature

        verdict = invoke_with_retry(
            model,
            [
                SystemMessage(
                    content=(
                        "Decide if the browser goal is complete using only the goal and page summary. "
                        "Return strict JSON only: "
                        '{"done": true|false, "reason": "...", "next_step_hint": "...", "stuck": true|false}.'
                    )
                ),
                HumanMessage(
                    content=(
                        f"Goal: {goal}\n"
                        f"Page summary: {verify_summary}\n"
                        f"Last agent update: {last_agent_text}\n"
                        f"Stagnant checks: {stagnant_checks}"
                    )
                ),
            ],
        )
        verdict_text = content_to_text(getattr(verdict, "content", ""))
        done = False
        stuck = False
        reason = "Unknown reason"
        next_step_hint = "Try a different action based on the current page."
        try:
            parsed = parse_verdict_json(verdict_text)
            done = bool(parsed.get("done", False))
            stuck = bool(parsed.get("stuck", False))
            reason = str(parsed.get("reason", reason))
            next_step_hint = str(parsed.get("next_step_hint", next_step_hint))
        except Exception:
            done = '"done": true' in verdict_text.lower()
            stuck = '"stuck": true' in verdict_text.lower()
            reason = verdict_text[:300] if verdict_text else reason

        if done:
            emit(f"Done. Completed overall task: {goal}")
            emit(f"Completion reason: {reason}")
            return

        extra_hint = ""
        if stagnant_checks >= 2 or stuck:
            extra_hint = (
                " The page state is not changing enough. Use a materially different tool or "
                "navigate somewhere else instead of repeating the last action."
            )

        messages = [
            *messages,
            HumanMessage(
                content=(
                    f"Task is not complete yet. Reason: {reason}. "
                    f"Suggested next direction: {next_step_hint}.{extra_hint}"
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
