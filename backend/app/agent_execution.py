import os
import queue
import threading
from dataclasses import dataclass, field
from typing import Any

from app.extension_automation import send_agent_log, send_command_sync
from app.langgraph.architecture_1 import run_architecture_1


@dataclass
class ProposedAction:
    action: str
    params: dict[str, Any] = field(default_factory=dict)


class AgentSession:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._out: queue.Queue[dict[str, Any]] = queue.Queue()
        self._pending_action: ProposedAction | None = None
        self._approval_event = threading.Event()
        self._approval_decision: str | None = None
        self._feedback: str | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._goal: str = ""

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def is_waiting_for_approval(self) -> bool:
        return self._pending_action is not None

    def start(self, goal: str) -> None:
        with self._lock:
            if self.is_running():
                self._emit("An agent session is already running. Type STOP to cancel.")
                return

            self._goal = (goal or "").strip()
            self._pending_action = None
            self._approval_decision = None
            self._feedback = None
            self._approval_event.clear()
            self._stop.clear()

            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._approval_event.set()

    def submit_user_message(self, text: str) -> None:
        msg = (text or "").strip()
        if not msg:
            return

        if msg.upper() == "STOP":
            self._emit("Stopping agent session...")
            self.stop()
            return

        if not self.is_waiting_for_approval():
            self._emit("No pending action to approve right now.")
            return

        if msg.upper() == "YES":
            self._approval_decision = "YES"
        else:
            self._approval_decision = "NO"
            self._feedback = msg

        self._approval_event.set()

    def stream(self):
        while True:
            item = self._out.get()
            yield item
            if item.get("done"):
                break

    def _emit(self, message: str) -> None:
        self._out.put({"message": message})
        send_agent_log(message)

    def _approve(self, action: str, params: dict[str, Any]) -> bool:
        self._pending_action = ProposedAction(action, params)
        self._approval_decision = None
        self._feedback = None
        self._approval_event.clear()

        self._emit(f"Proposed action: {action} {params}")
        self._emit("Type YES to run it, or send feedback. Type STOP to cancel.")
        self._approval_event.wait()

        self._pending_action = None
        if self._stop.is_set():
            return False

        approved = self._approval_decision == "YES"
        if not approved and self._feedback:
            self._emit(f"Feedback received: {self._feedback}")
        return approved

    def _approved_send(self, action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = params or {}

        if self._stop.is_set():
            return {"success": False, "error": "stopped"}

        if not self._approve(action, payload):
            return {"success": False, "error": "user_rejected", "feedback": self._feedback}

        result = send_command_sync(action, payload)
        if result.get("error") in {"No browser connected", "WebSocket server not running"}:
            self._emit("Browser extension not connected. Agent stopped.")
            self.stop()
        return result

    def _run(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            self._emit("Missing GEMINI_API_KEY env var.")
            self._out.put({"done": True})
            return

        self._emit(f"Agent started. Goal: {self._goal}")
        max_steps = int(os.getenv("AGENT_MAX_STEPS", "20"))

        run_architecture_1(
            api_key=api_key,
            goal=self._goal,
            max_steps=max_steps,
            emit=self._emit,
            approved_send=self._approved_send,
            stop_event=self._stop,
        )

        self._out.put({"done": True})


session = AgentSession()
