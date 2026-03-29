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


@dataclass
class PendingUserInput:
    question: str
    field_key: str
    reason: str = ""


class AgentSession:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._out: queue.Queue[dict[str, Any]] = queue.Queue()
        self._runtime_feedback: queue.Queue[str] = queue.Queue()
        self._pending_action: ProposedAction | None = None
        self._pending_user_input: PendingUserInput | None = None
        self._approval_event = threading.Event()
        self._approval_decision: str | None = None
        self._feedback: str | None = None
        self._user_input_event = threading.Event()
        self._user_input_value: str | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._goal: str = ""
        self._last_stopped_goal: str = ""
        self._require_approval: bool = False
        self._queued_goal: str | None = None
        self._restart_watcher_active: bool = False
        self._user_id: str = "local-user"
        self._agent_id: str = os.getenv("MEM0_AGENT_ID", "").strip() or "browser-agent"

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def is_waiting_for_approval(self) -> bool:
        return self._pending_action is not None

    def is_waiting_for_user_input(self) -> bool:
        return self._pending_user_input is not None

    def set_require_approval(self, enabled: bool) -> None:
        self._require_approval = bool(enabled)
        # If approvals are disabled while a tool is pending, auto-approve it.
        if not self._require_approval and self._pending_action is not None:
            self._approval_decision = "YES"
            self._approval_event.set()
            self._emit("Approval disabled: auto-approving pending tool call.")

    def get_require_approval(self) -> bool:
        return self._require_approval

    def set_user_id(self, user_id: str) -> None:
        normalized = (user_id or "").strip()
        if not normalized:
            raise ValueError("user_id cannot be empty")
        self._user_id = normalized
        self._emit(f"Active user id set to: {self._user_id}")

    def get_user_id(self) -> str:
        return self._user_id

    def set_agent_id(self, agent_id: str) -> None:
        normalized = (agent_id or "").strip()
        if not normalized:
            raise ValueError("agent_id cannot be empty")
        self._agent_id = normalized
        self._emit(f"Active agent id set to: {self._agent_id}")

    def get_agent_id(self) -> str:
        return self._agent_id

    def start(self, goal: str, *, restart_if_running: bool = False) -> None:
        old_thread: threading.Thread | None = None
        next_goal = (goal or "").strip()
        if not next_goal:
            self._emit("Missing goal text.")
            return

        with self._lock:
            if self.is_running():
                if not restart_if_running:
                    self._emit(
                        "An agent session is already running. Type STOP to cancel."
                    )
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
                self._emit(
                    "Current session is still stopping. New goal queued and will auto-start."
                )
                return

        with self._lock:
            if self.is_running():
                self._emit("An agent session is already running. Type STOP to cancel.")
                return

            self._goal = next_goal
            self._pending_action = None
            self._pending_user_input = None
            self._approval_decision = None
            self._feedback = None
            self._user_input_value = None
            self._runtime_feedback = queue.Queue()
            self._approval_event.clear()
            self._user_input_event.clear()
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
        if self._goal:
            self._last_stopped_goal = self._goal
        self._stop.set()
        self._approval_event.set()
        self._user_input_event.set()

    def resume_last_goal(self) -> bool:
        resumable_goal = self._last_stopped_goal.strip()
        if not resumable_goal or self.is_running():
            return False

        self._emit(f"Resuming last stopped goal: {resumable_goal}")
        self.start(resumable_goal, restart_if_running=False)
        return True

    def submit_runtime_feedback(self, text: str) -> bool:
        msg = (text or "").strip()
        if not msg:
            return False
        if not self.is_running():
            return False

        self._runtime_feedback.put(msg)
        self._emit(
            "Feedback delivered to agent. It will adjust on the next planning pass."
        )
        return True

    def drain_runtime_feedback(self) -> list[str]:
        items: list[str] = []
        while True:
            try:
                items.append(self._runtime_feedback.get_nowait())
            except queue.Empty:
                break
        return items

    def submit_user_message(self, text: str) -> str:
        msg = (text or "").strip()
        if not msg:
            return "ignored"

        if msg.upper() == "STOP":
            self._emit("Stopping agent session...")
            self.stop()
            return "stopped"

        if self.is_waiting_for_user_input():
            self._user_input_value = msg
            self._user_input_event.set()
            self._emit(
                f"User answer received for {self._pending_user_input.field_key}."
            )
            return "user_input"

        if self.is_waiting_for_approval():
            upper_msg = msg.upper()
            if upper_msg == "YES":
                self._approval_decision = "YES"
                self._approval_event.set()
                return "approval"

            if upper_msg == "NO":
                self._approval_decision = "NO"
                self._feedback = "Rejected by user."
                self._approval_event.set()
                return "approval"

            if upper_msg.startswith("FEEDBACK:"):
                feedback = msg.split(":", 1)[1].strip()
                if not feedback:
                    self._emit(
                        "Approval is pending. Use YES to approve, NO to reject, or FEEDBACK: <instruction>."
                    )
                    return "ignored"
                self._approval_decision = "NO"
                self._feedback = feedback
                self._approval_event.set()
                return "approval"

            self._emit(
                "Approval is pending. Use YES to approve, NO to reject, or FEEDBACK: <instruction>."
            )
            return "ignored"

        if self.submit_runtime_feedback(msg):
            return "feedback"

        self._emit("No active agent session to receive that message.")
        return "no_session"

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
            self._emit(
                f"[tool:auto-approved] {action} {json.dumps(params, ensure_ascii=True)}"
            )
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
            self._emit(
                f"[tool:approved] {action} {json.dumps(params, ensure_ascii=True)}"
            )
        if not approved and self._feedback:
            self._emit(f"Feedback received: {self._feedback}")
        return approved

    def request_user_input(
        self,
        question: str,
        *,
        field_key: str,
        reason: str = "",
    ) -> dict[str, Any]:
        normalized_question = (question or "").strip()
        normalized_field_key = (field_key or "").strip() or "user_input"
        normalized_reason = (reason or "").strip()

        if not normalized_question:
            return {"success": False, "error": "missing_question"}

        if self._stop.is_set():
            return {"success": False, "error": "stopped"}

        self._pending_user_input = PendingUserInput(
            question=normalized_question,
            field_key=normalized_field_key,
            reason=normalized_reason,
        )
        self._user_input_value = None
        self._user_input_event.clear()

        self._emit(
            "[user_input:request] "
            + json.dumps(
                {
                    "field_key": normalized_field_key,
                    "question": normalized_question,
                    "reason": normalized_reason,
                },
                ensure_ascii=True,
            )
        )
        self._emit(normalized_question)
        self._user_input_event.wait()

        pending = self._pending_user_input
        self._pending_user_input = None
        if self._stop.is_set():
            return {"success": False, "error": "stopped"}

        answer = (self._user_input_value or "").strip()
        self._user_input_value = None
        if not answer:
            return {"success": False, "error": "empty_user_input"}

        self._emit(
            "[user_input:answer] "
            + json.dumps(
                {
                    "field_key": pending.field_key if pending else normalized_field_key,
                    "value": answer,
                },
                ensure_ascii=True,
            )
        )
        return {
            "success": True,
            "field_key": pending.field_key if pending else normalized_field_key,
            "value": answer,
        }

    def _approved_send(
        self, action: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        payload = params or {}

        if self._stop.is_set():
            return {"success": False, "error": "stopped"}

        self._emit(f"[tool:call] {action} {json.dumps(payload, ensure_ascii=True)}")
        if not self._approve(action, payload):
            self._emit(f"[tool:rejected] {action}")
            return {
                "success": False,
                "error": "user_rejected",
                "feedback": self._feedback,
            }

        result = send_command_sync(action, payload)
        if not result.get("success", False):
            err = result.get("error", "unknown error")
            result["agent_feedback"] = (
                f"Tool '{action}' failed with error '{err}'. "
                "Choose a different action or different parameters."
            )
        emit_payload: dict[str, Any] | Any = result
        if action == "getPageStatus" and isinstance(result, dict):
            # Keep streamed tool logs compact; full page snapshots can be very large
            # and may freeze the UI while rendering chat events.
            emit_payload = {
                "success": bool(result.get("success", False)),
                "error": str(result.get("error") or ""),
                "title": str(result.get("title") or ""),
                "url": str(result.get("url") or ""),
                "scroll": result.get("scroll") or {},
                "headings_count": len(result.get("headings") or []),
                "buttons_count": len(result.get("buttons") or []),
                "inputs_count": len(result.get("inputs") or []),
                "links_count": len(result.get("links") or []),
                "images_count": len(result.get("images") or []),
                "paragraphs_count": len(result.get("paragraphs") or []),
            }
        try:
            compact = json.dumps(emit_payload, ensure_ascii=True)
        except Exception:
            compact = str(emit_payload)
        if len(compact) > 6000:
            compact = compact[:6000] + "...(truncated)"
        self._emit(f"[tool:result] {action} {compact}")
        error_text = str(result.get("error") or "")
        if (
            error_text == "WebSocket server not running"
            or "No browser connected" in error_text
            or "command timeout" in error_text.lower()
        ):
            self._emit(
                "Browser extension is not responding. Reload the extension tab and retry. Agent stopped."
            )
            self.stop()
        return result

    def _run(self) -> None:
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                self._emit("Missing GEMINI_API_KEY env var.")
                return

            self._emit(f"Agent started. Goal: {self._goal}")
            self._emit(f"Active user id: {self._user_id}")
            self._emit(f"Active agent id: {self._agent_id}")
            max_steps = 80

            run_architecture_1(
                api_key=api_key,
                goal=self._goal,
                user_id=self._user_id,
                agent_id=self._agent_id,
                max_steps=max_steps,
                emit=self._emit,
                approved_send=self._approved_send,
                request_user_input=self.request_user_input,
                get_runtime_feedback=self.drain_runtime_feedback,
                stop_event=self._stop,
            )
        except Exception as exc:
            self._emit(f"Agent crashed: {type(exc).__name__}: {exc}")
        finally:
            self._out.put({"done": True})


session = AgentSession()
