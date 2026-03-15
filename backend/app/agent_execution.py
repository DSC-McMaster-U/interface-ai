import os
import queue
import threading
import json
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
        self._require_approval: bool = True
        self._queued_goal: str | None = None
        self._restart_watcher_active: bool = False

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def is_waiting_for_approval(self) -> bool:
        return self._pending_action is not None

    def set_require_approval(self, enabled: bool) -> None:
        self._require_approval = bool(enabled)
        # If approvals are disabled while a tool is pending, auto-approve it.
        if not self._require_approval and self._pending_action is not None:
            self._approval_decision = "YES"
            self._approval_event.set()
            self._emit("Approval disabled: auto-approving pending tool call.")

    def get_require_approval(self) -> bool:
        return self._require_approval

    def start(self, goal: str, *, restart_if_running: bool = False) -> None:
        old_thread: threading.Thread | None = None
        next_goal = (goal or "").strip()
        if not next_goal:
            self._emit("Missing goal text.")
            return

        with self._lock:
            if self.is_running():
                if not restart_if_running:
                    self._emit("An agent session is already running. Type STOP to cancel.")
                    return
                self._emit("Stopping current session and starting new goal...")
                self.stop()
                old_thread = self._thread

        if old_thread:
            old_thread.join(timeout=5)
            if old_thread.is_alive():
                with self._lock:
                    self._queued_goal = next_goal
                    if not self._restart_watcher_active:
                        self._restart_watcher_active = True
                        watcher = threading.Thread(
                            target=self._wait_and_start_queued_goal,
                            args=(old_thread,),
                            daemon=True,
                        )
                        watcher.start()
                self._emit("Current session is still stopping. New goal queued and will auto-start.")
                return

        with self._lock:
            if self.is_running():
                self._emit("An agent session is already running. Type STOP to cancel.")
                return

            self._goal = next_goal
            self._pending_action = None
            self._approval_decision = None
            self._feedback = None
            self._approval_event.clear()
            self._stop.clear()

            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

    def _wait_and_start_queued_goal(self, old_thread: threading.Thread) -> None:
        old_thread.join(timeout=60)
        with self._lock:
            self._restart_watcher_active = False
            queued = self._queued_goal
            self._queued_goal = None

        if queued and not self.is_running():
            self._emit(f"Starting queued goal: {queued}")
            self.start(queued, restart_if_running=False)

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
        if not self._require_approval:
            self._emit(f"[tool:auto-approved] {action} {json.dumps(params, ensure_ascii=True)}")
            return True

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
        if approved:
            self._emit(f"[tool:approved] {action} {json.dumps(params, ensure_ascii=True)}")
        if not approved and self._feedback:
            self._emit(f"Feedback received: {self._feedback}")
        return approved

    def _approved_send(self, action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = params or {}

        if self._stop.is_set():
            return {"success": False, "error": "stopped"}

        self._emit(f"[tool:call] {action} {json.dumps(payload, ensure_ascii=True)}")
        if not self._approve(action, payload):
            self._emit(f"[tool:rejected] {action}")
            return {"success": False, "error": "user_rejected", "feedback": self._feedback}

        result = send_command_sync(action, payload)
        if not result.get("success", False):
            err = result.get("error", "unknown error")
            result["agent_feedback"] = (
                f"Tool '{action}' failed with error '{err}'. "
                "Choose a different action or different parameters."
            )
        try:
            compact = json.dumps(result, ensure_ascii=True)
        except Exception:
            compact = str(result)
        self._emit(f"[tool:result] {action} {compact}")
        if result.get("error") == "WebSocket server not running":
            self._emit("Browser extension WS server not running. Agent stopped.")
            self.stop()
        return result

    def _run(self) -> None:
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                self._emit("Missing GEMINI_API_KEY env var.")
                return

            self._emit(f"Agent started. Goal: {self._goal}")
            max_steps = 80

            run_architecture_1(
                api_key=api_key,
                goal=self._goal,
                max_steps=max_steps,
                emit=self._emit,
                approved_send=self._approved_send,
                stop_event=self._stop,
            )
        except Exception as exc:
            self._emit(f"Agent crashed: {type(exc).__name__}: {exc}")
        finally:
            self._out.put({"done": True})


session = AgentSession()
