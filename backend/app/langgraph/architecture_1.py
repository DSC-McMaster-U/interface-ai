import json
import os
import threading
from typing import Any, Callable

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent


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
    ]

    model = ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        google_api_key=api_key,
        temperature=0.2,
    )
    agent = create_react_agent(model=model, tools=tools)

    initial_status = approved_send("getPageStatus", {})
    context = json.dumps(initial_status)[:6000]

    inputs = {
        "messages": [
            SystemMessage(
                content=(
                    "You are a browser automation agent. Use tools to complete the goal. "
                    "Call one tool at a time and keep responses short. "
                    "When done, respond with a short final answer and no tool calls."
                )
            ),
            HumanMessage(content=f"Goal: {goal}"),
            HumanMessage(content=f"Initial page status: {context}"),
        ]
    }
    final_text = ""

    for i, state in enumerate(agent.stream(inputs, stream_mode="values"), start=1):
        if stop_event.is_set() or i > max_steps:
            break

        messages = state.get("messages") or []
        if not messages:
            continue

        last = messages[-1]
        if isinstance(last, AIMessage):
            text = (last.content or "").strip()
            if text:
                final_text = text
                emit(f"Agent: {text}")

    if stop_event.is_set():
        emit("Agent stopped.")
    elif final_text:
        emit(final_text)
