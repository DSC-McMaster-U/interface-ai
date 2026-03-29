import json
import threading
from typing import Any, Callable

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from app.langgraph.utilities import (
    content_to_text,
    invoke_with_retry,
    parse_json_payload,
    parse_verdict_json,
)
from app.continuous_learning import (
    BrowserMemoryStore,
    extract_domain_from_status,
    format_memory_lines,
    infer_target_domain,
    infer_task_type,
    normalize_agent_memory_entries,
    normalize_user_memory_entries,
)


def run_architecture_1(
    *,
    api_key: str,
    goal: str,
    user_id: str,
    agent_id: str,
    max_steps: int,
    emit: Callable[[str], None],
    approved_send: Callable[[str, dict[str, Any] | None], dict[str, Any]],
    request_user_input: Callable[..., dict[str, Any]],
    get_runtime_feedback: Callable[[], list[str]],
    stop_event: threading.Event,
) -> None:
    memory_store = BrowserMemoryStore(agent_id=agent_id)
    action_trace: list[dict[str, Any]] = []
    user_inputs: list[dict[str, str]] = []
    agent_updates: list[str] = []
    consecutive_action_signature = ""
    consecutive_action_count = 0

    def tracked_send(
        action: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        nonlocal consecutive_action_signature, consecutive_action_count
        payload = params or {}
        signature = json.dumps(
            {"action": action, "params": payload},
            ensure_ascii=True,
            sort_keys=True,
        )
        if signature == consecutive_action_signature:
            consecutive_action_count += 1
        else:
            consecutive_action_signature = signature
            consecutive_action_count = 1

        if consecutive_action_count >= 3:
            blocked = {
                "success": False,
                "error": "repetitive_action_blocked",
                "agent_feedback": (
                    f"Tool '{action}' with the same parameters has already been tried "
                    "multiple times without progress. Do not repeat it again right now. "
                    "Inspect the page, choose a different action, or ask the user to unblock you."
                ),
            }
            action_trace.append(
                {
                    "action": action,
                    "params": payload,
                    "success": False,
                    "error": blocked["error"],
                    "result_summary": blocked,
                }
            )
            emit(f"[tool:result] {action} {json.dumps(blocked, ensure_ascii=True)}")
            return blocked

        result = approved_send(action, params)
        result_summary = {
            "success": bool(result.get("success", False)),
            "error": str(result.get("error") or ""),
            "url": str(result.get("url") or ""),
            "title": str(result.get("title") or ""),
        }
        action_trace.append(
            {
                "action": action,
                "params": params or {},
                "success": bool(result.get("success", False)),
                "error": result.get("error", ""),
                "result_summary": result_summary,
            }
        )
        return result

    def memory_log(kind: str, operation: str, payload: dict[str, Any]) -> None:
        tool_name = {
            ("user", "call"): "getUserMemory",
            ("user", "result"): "getUserMemory",
            ("user", "add"): "addUserMemory",
            ("agent", "call"): "getAgentMemory",
            ("agent", "result"): "getAgentMemory",
            ("agent", "add"): "addAgentMemory",
        }[(kind, operation)]
        prefix = "[tool:call]" if operation in {"call", "add"} else "[tool:result]"
        emit(f"{prefix} {tool_name} {json.dumps(payload, ensure_ascii=True)}")

    def search_user_memory(
        *,
        query: str,
        field_key: str = "",
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        payload = {"user_id": user_id, "query": query, "field_key": field_key, "limit": limit}
        memory_log("user", "call", payload)
        results = memory_store.search_user_memories(
            user_id=user_id,
            query=query,
            field_key=field_key,
            limit=limit,
        )
        memory_log("user", "result", {"count": len(results), "results": results[:3]})
        return results

    def search_agent_memory(
        *,
        query: str,
        current_domain: str,
        target_domain: str,
        task_type: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        payload = {
            "query": query,
            "current_domain": current_domain,
            "target_domain": target_domain,
            "task_type": task_type,
            "limit": limit,
        }
        memory_log("agent", "call", payload)
        results = memory_store.search_agent_memories(
            goal=query,
            current_domain=current_domain,
            target_domain=target_domain,
            task_type=task_type,
            limit=limit,
        )
        memory_log("agent", "result", {"count": len(results), "results": results[:3]})
        return results

    def add_user_memory_entries(entries: list[dict[str, str]]) -> None:
        for entry in entries:
            payload = {
                "user_id": user_id,
                "field_key": entry["field_key"],
                "fact": entry["fact"],
            }
            memory_log("user", "add", payload)
            memory_store.add_user_memory(
                user_id=user_id,
                fact=entry["fact"],
                field_key=entry["field_key"],
                source="request_user_input",
            )

    def add_agent_memory_entries(entries: list[dict[str, Any]]) -> None:
        for entry in entries:
            memory_log(
                "agent",
                "add",
                {
                    "fact": entry["fact"],
                    "domain": entry["domain"],
                    "target_domain": entry["target_domain"],
                    "task_type": entry["task_type"],
                    "confidence": entry["confidence"],
                },
            )
            memory_store.add_agent_memory(
                fact=entry["fact"],
                domain=entry["domain"],
                target_domain=entry["target_domain"],
                task_type=entry["task_type"],
                confidence=float(entry["confidence"]),
            )

    def persist_memories(
        *,
        success: bool,
        completion_reason: str,
        initial_status: dict[str, Any],
        final_status: dict[str, Any],
    ) -> None:
        try:
            if user_id:
                for item in user_inputs:
                    extraction = invoke_with_retry(
                        model,
                        [
                            SystemMessage(
                                content=(
                                    "Extract long-term user memory from a user answer. "
                                    "Only keep stable profile facts or durable preferences that should help future tasks. "
                                    "Do not store temporary workflow acknowledgements, one-off form answers, file-upload confirmations, or ephemeral task details. "
                                    "Return strict JSON only as an array of objects: "
                                    '[{"field_key":"snake_case_key","fact":"short natural-language memory sentence"}]. '
                                    "Return [] if nothing should be stored."
                                )
                            ),
                            HumanMessage(
                                content=(
                                    f"Goal: {goal}\n"
                                    f"Question field key: {item.get('field_key', '')}\n"
                                    f"Question reason: {item.get('reason', '')}\n"
                                    f"User answer: {item.get('value', '')}"
                                )
                            ),
                        ],
                    )
                    entries = normalize_user_memory_entries(
                        parse_json_payload(content_to_text(getattr(extraction, "content", "")))
                    )
                    add_user_memory_entries(entries)

            agent_summary = invoke_with_retry(
                model,
                [
                    SystemMessage(
                        content=(
                            "Summarize a browser-agent run into long-term shared agent memory. "
                            "Focus on: where it looped or wasted time, what went wrong, and what actual path or shortcut worked. "
                            "Write short natural-language memory sentences that help the agent finish faster next time. "
                            "Prefer specific shortcut guidance like going directly to a useful page instead of broad searching. "
                            "Return strict JSON only as an array of objects: "
                            '[{"fact":"...","domain":"...","target_domain":"...","task_type":"...","confidence":0.0}]. '
                            "Return [] if nothing reusable was learned."
                        )
                    ),
                    HumanMessage(
                        content=(
                            f"Goal: {goal}\n"
                            f"Success: {success}\n"
                            f"Completion reason: {completion_reason}\n"
                            f"Initial status: {json.dumps(initial_status, ensure_ascii=True)[:3000]}\n"
                            f"Final status: {json.dumps(final_status, ensure_ascii=True)[:3000]}\n"
                            f"Agent updates: {json.dumps(agent_updates[-25:], ensure_ascii=True)}\n"
                            f"Action trace: {json.dumps(action_trace[-80:], ensure_ascii=True)}"
                        )
                    ),
                ],
            )
            agent_entries = normalize_agent_memory_entries(
                parse_json_payload(content_to_text(getattr(agent_summary, "content", "")))
            )
            add_agent_memory_entries(agent_entries)
            emit("Continuous learning updated.")
        except Exception as exc:
            emit(f"Continuous learning write skipped: {type(exc).__name__}: {exc}")

    @tool
    def goto(url: str) -> dict[str, Any]:
        """Navigate current tab to url."""
        return tracked_send("goto", {"url": url})

    @tool
    def clickByName(name: str, exactMatch: bool = False) -> dict[str, Any]:
        """Click element by visible text."""
        return tracked_send("clickByName", {"name": name, "exactMatch": exactMatch})

    @tool
    def fillInput(identifier: str, value: str) -> dict[str, Any]:
        """Fill input field by identifier with value."""
        return tracked_send("fillInput", {"identifier": identifier, "value": value})

    @tool
    def pressEnter() -> dict[str, Any]:
        """Press Enter key in active element."""
        return tracked_send("pressEnter", {})

    @tool
    def scrollDown(pixels: int = 500) -> dict[str, Any]:
        """Scroll down by pixels."""
        return tracked_send("scrollDown", {"pixels": pixels})

    @tool
    def scrollUp(pixels: int = 500) -> dict[str, Any]:
        """Scroll up by pixels."""
        return tracked_send("scrollUp", {"pixels": pixels})

    @tool
    def scrollToTop() -> dict[str, Any]:
        """Scroll to top."""
        return tracked_send("scrollToTop", {})

    @tool
    def scrollToBottom() -> dict[str, Any]:
        """Scroll to bottom."""
        return tracked_send("scrollToBottom", {})

    @tool
    def goBack() -> dict[str, Any]:
        """Navigate back in history."""
        return tracked_send("goBack", {})

    @tool
    def goForward() -> dict[str, Any]:
        """Navigate forward in history."""
        return tracked_send("goForward", {})

    @tool
    def getPageStatus() -> dict[str, Any]:
        """Get page snapshot (url/title/elements)."""
        return tracked_send("getPageStatus", {})

    @tool
    def clickFirstSearchResult() -> dict[str, Any]:
        """Click first search result on results page."""
        return tracked_send("clickFirstSearchResult", {})

    @tool
    def pressKey(key: str) -> dict[str, Any]:
        """Press keyboard key (Tab/Escape/ArrowDown/etc)."""
        return tracked_send("pressKey", {"key": key})

    @tool
    def typeText(text: str) -> dict[str, Any]:
        """Type text into active element."""
        return tracked_send("typeText", {"text": text})

    @tool
    def selectOption(identifier: str, value: str) -> dict[str, Any]:
        """Select a dropdown option by field identifier and option text/value."""
        return tracked_send("selectOption", {"identifier": identifier, "value": value})

    @tool
    def clickFileInput(identifier: str) -> dict[str, Any]:
        """Open file picker by file input identifier."""
        return tracked_send("clickFileInput", {"identifier": identifier})

    @tool
    def requestUserInput(
        question: str, fieldKey: str, reason: str = ""
    ) -> dict[str, Any]:
        """Ask the user for task-critical missing information and wait for their answer."""
        result = request_user_input(
            question,
            field_key=fieldKey,
            reason=reason,
        )
        if result.get("success"):
            user_inputs.append(
                {
                    "field_key": str(result.get("field_key") or fieldKey),
                    "value": str(result.get("value") or ""),
                    "reason": reason,
                }
            )
        action_trace.append(
            {
                "action": "requestUserInput",
                "params": {"fieldKey": fieldKey, "reason": reason},
                "success": bool(result.get("success", False)),
                "error": result.get("error", ""),
            }
        )
        return result

    @tool
    def getUserToUnblock(instruction: str, reason: str = "") -> dict[str, Any]:
        """Ask the user to manually perform a blocking step, then reply when it is done so the agent can continue."""
        result = request_user_input(
            instruction,
            field_key="manual_unblock",
            reason=reason or "Manual action required to unblock agent progress.",
        )
        action_trace.append(
            {
                "action": "getUserToUnblock",
                "params": {"instruction": instruction, "reason": reason},
                "success": bool(result.get("success", False)),
                "error": result.get("error", ""),
                "result_summary": {
                    "success": bool(result.get("success", False)),
                    "value": str(result.get("value") or ""),
                },
            }
        )
        return result

    @tool
    def getUserMemory(query: str = "", fieldKey: str = "") -> dict[str, Any]:
        """Retrieve stored user-level facts like name, location, preferences, and prior answers."""
        if not user_id:
            return {"success": False, "error": "missing_user_id", "results": []}
        results = search_user_memory(query=query or goal, field_key=fieldKey, limit=5)
        return {"success": True, "results": results}

    @tool
    def getAgentMemory(query: str = "") -> dict[str, Any]:
        """Retrieve reusable browser-agent lessons, workflows, shortcuts, and failure patterns."""
        lookup_goal = query or goal
        task_type = infer_task_type(lookup_goal)
        current_domain = extract_domain_from_status(latest_status)
        target_domain = infer_target_domain(lookup_goal)
        results = search_agent_memory(
            query=lookup_goal,
            current_domain=current_domain,
            target_domain=target_domain,
            task_type=task_type,
            limit=6,
        )
        return {"success": True, "results": results}

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
        getUserToUnblock,
        getUserMemory,
        getAgentMemory,
    ]

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.2,
    )
    agent = create_react_agent(model=model, tools=tools)

    initial_status = tracked_send("getPageStatus", {})
    context = json.dumps(initial_status)[:6000]
    latest_status = initial_status
    emit(f"Memory backend: {memory_store.backend_name()}")
    current_domain = extract_domain_from_status(initial_status)
    target_domain = infer_target_domain(goal)
    task_type = infer_task_type(goal)
    user_memories = search_user_memory(query=goal, limit=5)
    agent_memories = search_agent_memory(
        query=goal,
        current_domain=current_domain,
        target_domain=target_domain,
        task_type=task_type,
        limit=8,
    )
    user_memory_context = format_memory_lines("Known user facts:", user_memories)
    agent_memory_context = format_memory_lines(
        "Shared browser-agent knowledge:",
        agent_memories,
    )

    messages: list[BaseMessage] = [
        SystemMessage(
            content=(
                "You are a browser automation agent. Use tools to complete the goal. "
                "Call one tool at a time. If a tool fails, you must try a different approach. "
                "Use getPageStatus often; it includes dropdowns (selects) and file inputs when present. "
                "Do not say done until completion is verified from getPageStatus. "
                "Always continue going and calling tools until the goal is complete; do not stop midway. "
                "Be persistent and try different approaches if you fail. "
                "Use requestUserInput only when the task cannot safely continue without task-critical user-specific data or a critical choice that cannot be inferred from the goal or page. "
                "Use getUserToUnblock when you are stuck because the user must manually do something in the UI, such as upload a file, solve a login/CAPTCHA issue, or complete a blocking step you cannot do. "
                "Ask for the exact unblock action in one short instruction and wait for the user to confirm it is done. "
                "Do not ask for low-stakes ambiguities when a reasonable default is acceptable. "
                "Use getUserMemory before asking for details that may already be known, like the user's name or location. "
                "Use getAgentMemory when you need reusable workflow hints, site shortcuts, or prior failure lessons. "
                "Do not repeat the same tool call with the same parameters more than twice in a row. "
                "If a button press, page, or flow is not moving you forward, stop repeating it. Inspect the page, try a different route, or ask the user to unblock you. "
                "Example: for 'play minecraft vid', do not ask what site to use; just choose a reasonable place like YouTube and proceed. "
                "Example: for a job application, if the form requires personal details like legal name, phone number, or a specific internship choice that is not clearly determined, ask a single precise question with requestUserInput. "
            )
        ),
        HumanMessage(content=f"Goal: {goal}"),
        HumanMessage(content=f"Initial page status: {context}"),
    ]
    if user_memory_context:
        messages.append(HumanMessage(content=user_memory_context))
        emit(f"Loaded {len(user_memories)} user memories for user_id={user_id}.")
    if agent_memory_context:
        messages.append(HumanMessage(content=agent_memory_context))
        emit(f"Loaded {len(agent_memories)} agent memories for this task.")

    remaining_attempts = max_steps
    last_agent_text = ""
    latest_reason = "Stopped before completion."

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
                            "This feedback updates how to pursue the same task and has higher priority "
                            "than your previous path. Replan from the current browser state so the next "
                            "tool call follows this updated direction."
                        )
                    ),
                ]
                emit(f"Runtime feedback received: {feedback}")

        latest_messages = messages
        starting_tool_message_count = sum(
            1 for message in messages if isinstance(message, ToolMessage)
        )

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
                            agent_updates.append(text)
                            emit(f"Agent: {text}")
                    current_tool_message_count = sum(
                        1
                        for message in latest_messages
                        if isinstance(message, ToolMessage)
                    )
                    # Stop after one completed tool step so new feedback can steer the next tool call.
                    if (
                        current_tool_message_count > starting_tool_message_count
                        or i >= 25
                        or stop_event.is_set()
                    ):
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

        verify_status = tracked_send("getPageStatus", {})
        latest_status = verify_status
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
        latest_reason = reason

        if done:
            emit(f"Done. Completed overall task: {goal}")
            emit(f"Completion reason: {reason}")
            persist_memories(
                success=True,
                completion_reason=reason,
                initial_status=initial_status,
                final_status=latest_status,
            )
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
        persist_memories(
            success=False,
            completion_reason="Agent stopped by user.",
            initial_status=initial_status,
            final_status=latest_status,
        )
    elif last_agent_text:
        emit(f"Stopped before completion. Last agent update: {last_agent_text}")
        persist_memories(
            success=False,
            completion_reason=latest_reason,
            initial_status=initial_status,
            final_status=latest_status,
        )
    else:
        emit("Stopped before completion.")
        persist_memories(
            success=False,
            completion_reason=latest_reason,
            initial_status=initial_status,
            final_status=latest_status,
        )
