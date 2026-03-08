import json
import os
import queue
import threading
from dataclasses import dataclass, field
from typing import Annotated, Any, TypedDict

from app.extension_automation import send_agent_log, send_command_sync


@dataclass
class ProposedAction:
    action: str
    params: dict[str, Any] = field(default_factory=dict)


class AgentSession:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._out: queue.Queue[dict[str, Any]] = queue.Queue()
        self._pending_action: ProposedAction | None = None
        self._waiting_for_approval = threading.Event()
        self._approval_decision: str | None = None
        self._feedback: str | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._goal: str | None = None
        self._history: list[dict[str, Any]] = []

    def is_running(self) -> bool:
        t = self._thread
        return bool(t and t.is_alive())

    def is_waiting_for_approval(self) -> bool:
        return self._pending_action is not None

    def start(self, goal: str) -> None:
        with self._lock:
            if self._thread and self._thread.is_alive():
                self._out.put({"message": "An agent session is already running. Type STOP to cancel."})
                return
            self._goal = goal
            self._history = []
            self._pending_action = None
            self._approval_decision = None
            self._feedback = None
            self._waiting_for_approval.clear()
            self._stop.clear()

            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._waiting_for_approval.set()

    def submit_user_message(self, text: str) -> None:
        msg = (text or "").strip()
        if not msg:
            return
        if msg.upper() == "STOP":
            self._out.put({"message": "Stopping agent session..."})
            self.stop()
            return

        if self._pending_action is None:
            self._out.put({"message": "No pending action to approve right now."})
            return

        if msg.upper() == "YES":
            self._approval_decision = "YES"
            self._waiting_for_approval.set()
            return

        self._approval_decision = "NO"
        self._feedback = msg
        self._waiting_for_approval.set()

    def stream(self):
        while True:
            item = self._out.get()
            yield item
            if item.get("done"):
                break

    def _emit(self, message: str, *, also_ws: bool = True) -> None:
        payload = {"message": message}
        self._out.put(payload)
        try:
            print(message, flush=True)
        except Exception:
            pass
        if also_ws:
            send_agent_log(message)

    def _run(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            self._emit("Missing GEMINI_API_KEY env var.")
            self._out.put({"done": True})
            return

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.callbacks import BaseCallbackHandler
            from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
            from langchain_core.tools import tool
            from langchain_core.globals import set_debug, set_verbose
        except Exception:
            self._emit("Missing dependency: langchain-google-genai. Rebuild backend after installing requirements.")
            self._out.put({"done": True})
            return

        try:
            from langgraph.graph import END, StateGraph
            from langgraph.graph.message import add_messages
            from langgraph.prebuilt import ToolNode
        except Exception:
            self._emit("Missing dependency: langgraph. Rebuild backend after installing requirements.")
            self._out.put({"done": True})
            return

        if os.getenv("LANGCHAIN_DEBUG", "").strip() in {"1", "true", "TRUE", "yes", "YES"}:
            set_debug(True)
        if os.getenv("LANGCHAIN_VERBOSE", "").strip() in {"1", "true", "TRUE", "yes", "YES"}:
            set_verbose(True)

        class _AgentCallbacks(BaseCallbackHandler):
            def __init__(self, emit):
                self._emit = emit

            def on_llm_start(self, serialized, prompts, **kwargs):
                self._emit("LLM thinking...")

            def on_tool_start(self, serialized, input_str=None, **kwargs):
                name = serialized.get("name") if isinstance(serialized, dict) else None
                self._emit(f"Tool start: {name}")

            def on_tool_end(self, output, **kwargs):
                out = output
                try:
                    out = json.dumps(output)
                except Exception:
                    out = str(output)
                self._emit(f"Tool end: {out[:1200]}")

            def on_agent_finish(self, finish, **kwargs):
                self._emit("Agent finished.")

        llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
            google_api_key=api_key,
            temperature=0.2,
            callbacks=[_AgentCallbacks(self._emit)],
        )

        goal = self._goal or ""
        self._emit(f"Agent started. Goal: {goal}")

        max_steps = int(os.getenv("AGENT_MAX_STEPS", "25"))
        max_obs_chars = int(os.getenv("AGENT_MAX_OBS_CHARS", "20000"))
        context_chars = int(os.getenv("AGENT_CONTEXT_CHARS", "6000"))
        if context_chars < 500:
            context_chars = 500

        def _approved_send(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
            if self._stop.is_set():
                return {"success": False, "error": "stopped"}

            p = ProposedAction(action, params or {})
            self._emit(f"Proposing tool call: {action} {p.params}")
            if not self._approve(p):
                return {"success": False, "error": "user_rejected", "feedback": self._feedback}

            result = send_command_sync(action, p.params)
            err = result.get("error") if isinstance(result, dict) else None
            if err in {"No browser connected", "WebSocket server not running"}:
                self._emit(f"Agent cannot continue: {err}. Make sure the Chrome extension is running and connected.")
                self.stop()
            return result

        @tool(description="Navigate the current tab to the given URL.")
        def goto(url: str) -> dict[str, Any]:
            return _approved_send("goto", {"url": url})

        @tool(description="Click an element (button/link) by its visible text name.")
        def clickByName(name: str, exactMatch: bool = False) -> dict[str, Any]:
            return _approved_send("clickByName", {"name": name, "exactMatch": exactMatch})

        @tool(description="Fill an input field identified by label/placeholder/name with the given value.")
        def fillInput(identifier: str, value: str) -> dict[str, Any]:
            return _approved_send("fillInput", {"identifier": identifier, "value": value})

        @tool(description="Press Enter in the active element.")
        def pressEnter() -> dict[str, Any]:
            return _approved_send("pressEnter", {})

        @tool(description="Scroll down by a number of pixels.")
        def scrollDown(pixels: int = 500) -> dict[str, Any]:
            return _approved_send("scrollDown", {"pixels": pixels})

        @tool(description="Scroll up by a number of pixels.")
        def scrollUp(pixels: int = 500) -> dict[str, Any]:
            return _approved_send("scrollUp", {"pixels": pixels})

        @tool(description="Scroll to the top of the page.")
        def scrollToTop() -> dict[str, Any]:
            return _approved_send("scrollToTop", {})

        @tool(description="Scroll to the bottom of the page.")
        def scrollToBottom() -> dict[str, Any]:
            return _approved_send("scrollToBottom", {})

        @tool(description="Navigate back in browser history.")
        def goBack() -> dict[str, Any]:
            return _approved_send("goBack", {})

        @tool(description="Navigate forward in browser history.")
        def goForward() -> dict[str, Any]:
            return _approved_send("goForward", {})

        @tool(description="Get a structured snapshot of the current page (url, title, visible elements, etc.).")
        def getPageStatus() -> dict[str, Any]:
            return _approved_send("getPageStatus", {})

        @tool(description="Click the first search result on a search results page.")
        def clickFirstSearchResult() -> dict[str, Any]:
            return _approved_send("clickFirstSearchResult", {})

        @tool(description="Press a specific key (e.g. Tab, Escape, ArrowDown).")
        def pressKey(key: str) -> dict[str, Any]:
            return _approved_send("pressKey", {"key": key})

        @tool(description="Type the given text into the active element.")
        def typeText(text: str) -> dict[str, Any]:
            return _approved_send("typeText", {"text": text})

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

        bound_llm = llm.bind_tools(tools)

        class AgentState(TypedDict):
            messages: Annotated[list[BaseMessage], add_messages]
            steps: int

        def agent_node(state: AgentState) -> AgentState:
            if self._stop.is_set():
                return {"messages": state["messages"], "steps": state["steps"]}

            if state["steps"] >= max_steps:
                final = AIMessage(content="Max steps reached without completing the goal.")
                return {"messages": [final], "steps": state["steps"]}

            resp = bound_llm.invoke(state["messages"])
            if isinstance(resp, AIMessage):
                empty = (resp.content or "").strip() == "" and not getattr(resp, "tool_calls", None)
                if empty:
                    nudge = HumanMessage(
                        content=(
                            "Your previous response was empty. Call exactly ONE tool now to make progress. "
                            "Start with getPageStatus unless you are already certain about the next interaction."
                        )
                    )
                    resp = bound_llm.invoke([*state["messages"], nudge])
            if isinstance(resp, AIMessage):
                content = (resp.content or "").strip()
                if content:
                    self._emit(f"Agent: {content}")
                tool_calls = getattr(resp, "tool_calls", None)
                if tool_calls:
                    self._emit(f"Agent proposed tool calls: {json.dumps(tool_calls)[:1200]}")
            return {"messages": [resp], "steps": state["steps"] + 1}

        def should_continue(state: AgentState) -> str:
            msgs = state["messages"]
            if not msgs:
                return END
            last = msgs[-1]
            if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
                return "tools"
            return END

        tool_node = ToolNode(tools)

        graph = StateGraph(AgentState)
        graph.add_node("agent", agent_node)
        graph.add_node("tools", tool_node)
        graph.set_entry_point("agent")
        graph.add_conditional_edges("agent", should_continue)
        graph.add_edge("tools", "agent")
        app = graph.compile()

        system = SystemMessage(
            content=(
                "You are an autonomous browser agent. Use the provided tools to achieve the user's goal. "
                "You MUST make progress by calling tools (one at a time) until the goal is complete. "
                "Call ONE tool at a time. Prefer calling getPageStatus frequently to ground your actions. "
                "Do not invent UI elements; rely on getPageStatus output. If a tool fails, try a different tool call. "
                "When the goal is satisfied, respond with a short final message and do not call tools."
            )
        )

        initial_status = _approved_send("getPageStatus", {})
        if self._stop.is_set():
            self._out.put({"done": True})
            return
        initial_json = json.dumps(initial_status)
        limit = max_obs_chars
        if context_chars > 0:
            limit = min(limit, context_chars)
        if limit > 0:
            initial_json = initial_json[:limit]

        messages: list[BaseMessage] = [
            system,
            HumanMessage(content=f"Goal: {goal}"),
            HumanMessage(content=f"Initial page status JSON: {initial_json}"),
            HumanMessage(content="Next: call exactly one tool to make progress."),
        ]

        final_messages: list[BaseMessage] = []
        try:
            for state in app.stream(
                {"messages": messages, "steps": 0},
                config={"recursion_limit": max_steps * 4},
                stream_mode="values",
            ):
                final_messages = state.get("messages", [])
                if self._stop.is_set():
                    break
        except Exception as e:
            self._emit(f"Agent error: {type(e).__name__}: {e}")

        if self._stop.is_set():
            self._emit("Agent stopped.")
        elif final_messages:
            last = final_messages[-1]
            if isinstance(last, AIMessage):
                content = (last.content or "").strip()
                if content:
                    self._emit(content)
        self._out.put({"done": True})

    def _approve(self, proposed: ProposedAction) -> bool:
        self._pending_action = proposed
        self._approval_decision = None
        self._feedback = None
        self._waiting_for_approval.clear()

        self._emit("Type YES to run it, or type feedback to change approach. (Type STOP to cancel)")

        self._waiting_for_approval.wait()

        if self._stop.is_set():
            return False

        decision = self._approval_decision
        if decision == "YES":
            self._pending_action = None
            return True

        feedback = self._feedback
        if feedback:
            self._emit(f"Feedback received: {feedback}")
        self._pending_action = None
        return False


session = AgentSession()
