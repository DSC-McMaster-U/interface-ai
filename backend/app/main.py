import json
import logging

import requests
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from app.agent_execution import session
from app.db import get_profile, init_tables, upsert_profile
from app.extension_automation import (
    is_server_running,
    send_command_sync,
    start_websocket_server,
)

logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------------------------------------------------------------------------
# Database initialisation
# ---------------------------------------------------------------------------
try:
    init_tables()
    logger.info("Database tables ready.")
except Exception as exc:
    logger.warning("Could not initialise DB tables (will retry on first request): %s", exc)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return "ok", 200


# ---------------------------------------------------------------------------
# Google OAuth token verification
# ---------------------------------------------------------------------------

GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo"


@app.post("/api/auth/google")
def auth_google():
    """Accept a Google OAuth access token, verify it, and return user info."""
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "missing token"}), 400

    # Verify the token with Google
    resp = requests.get(GOOGLE_TOKENINFO_URL, params={"access_token": token}, timeout=10)
    if resp.status_code != 200:
        return jsonify({"error": "invalid token"}), 401

    info = resp.json()
    email = info.get("email", "")
    user_id = info.get("sub", email)

    if not user_id:
        return jsonify({"error": "could not determine user id"}), 400

    # Ensure profile row exists
    profile = get_profile(user_id)
    if not profile.get("preferences"):
        # Seed with email
        upsert_profile(user_id, {"email": email})
        profile = get_profile(user_id)

    return jsonify({
        "user_id": user_id,
        "email": email,
        "profile": profile,
    }), 200


# ---------------------------------------------------------------------------
# Profile CRUD
# ---------------------------------------------------------------------------

@app.get("/api/profile")
def get_user_profile():
    """Return the profile for the given user_id query param."""
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "missing user_id"}), 400
    profile = get_profile(user_id)
    return jsonify(profile), 200


@app.post("/api/profile")
def update_user_profile():
    """Upsert the user profile preferences."""
    data = request.get_json(silent=True) or {}
    user_id = (data.get("user_id") or "").strip()
    preferences = data.get("preferences")
    if not user_id:
        return jsonify({"error": "missing user_id"}), 400
    if preferences is None:
        return jsonify({"error": "missing preferences"}), 400

    profile = upsert_profile(user_id, preferences)
    return jsonify(profile), 200


@app.get("/api/extension/health")
def api_extension_health():
    running = is_server_running()
    status = "ok" if running else "error"
    message = (
        "Extension WS server running" if running else "Extension WS server not started"
    )
    return jsonify({"status": status, "message": message}), 200 if running else 503


@app.post("/api/extension/command")
def api_extension_command():
    data = request.get_json(silent=True) or {}
    action = (data.get("action") or "").strip()
    params = data.get("params") or {}

    if not action:
        return jsonify({"error": "missing action"}), 400

    return jsonify(send_command_sync(action, params)), 200


@app.route("/api/relay", methods=["GET", "POST"])
def relay():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        message = data.get("message", "")
        user_id = data.get("user_id", "")
    else:
        message = request.args.get("message", "")
        user_id = request.args.get("user_id", "")

    msg = (message or "").strip()
    uid = (user_id or "").strip() or None

    if msg.upper().startswith("GOAL:"):
        goal = msg.split(":", 1)[-1].strip()
        if not goal:
            return _sse([{"message": "Missing goal text after GOAL:"}, {"done": True}])

        session.set_user_id(uid)
        session.start(goal, restart_if_running=True)

        def stream_agent():
            for item in session.stream():
                if "message" in item:
                    yield {"message": item["message"]}
                if item.get("done"):
                    yield {"done": True}
                    break

        return _sse(stream_agent())

    non_goal_items = _handle_non_goal_command(msg)
    return _sse(non_goal_items)


@app.post("/api/relay_once")
def relay_once():
    msg = ((request.get_json(silent=True) or {}).get("message") or "").strip()
    items = _handle_non_goal_command(msg)
    message = next(
        (str(item.get("message", "")) for item in items if "message" in item), ""
    )
    done = any(bool(item.get("done")) for item in items)
    return jsonify({"message": message, "done": done})


def _handle_non_goal_command(msg: str) -> list[dict[str, object]]:
    if msg.upper() == "STOP":
        result = session.submit_user_message("STOP")
        if result == "stopped":
            return [{"message": "Stopping agent session..."}, {"done": True}]
        return [{"message": "No active agent session to stop."}, {"done": True}]

    if msg.upper() == "UNSTOP":
        if session.resume_last_goal():
            return [{"message": "Resuming most recent stopped goal."}, {"done": True}]
        return [
            {"message": "No recently stopped goal is available to resume."},
            {"done": True},
        ]

    if msg.upper() == "HELP":
        help_text = (
            "GOAL: <task> - start a new browser automation task.\n\n"
            "FEEDBACK: <instruction> - redirect the running agent before its next tool call.\n\n"
            "STOP - stop the current agent session.\n\n"
            "UNSTOP - resume the most recently stopped goal.\n\n"
            "APPROVAL ON - require approval before each browser tool call.\n\n"
            "APPROVAL OFF - auto-approve browser tool calls.\n\n"
            "APPROVAL STATUS - show whether approvals are on or off.\n\n"
            "CLEAR - clear chat history in the overlay.\n\n"
            "If the agent asks for missing information, just reply normally in chat with the answer.\n\n"
            "If the agent is waiting for approval, reply YES to allow the tool call or send feedback to reject and redirect it."
        )
        return [{"message": help_text}, {"done": True}]

    if msg.upper() == "APPROVAL ON":
        session.set_require_approval(True)
        return [{"message": "Approval mode: ON"}, {"done": True}]

    if msg.upper() == "APPROVAL OFF":
        session.set_require_approval(False)
        return [{"message": "Approval mode: OFF"}, {"done": True}]

    if msg.upper() == "APPROVAL STATUS":
        status = "ON" if session.get_require_approval() else "OFF"
        return [{"message": f"Approval mode: {status}"}, {"done": True}]

    if msg and (
        session.is_waiting_for_approval() or session.is_waiting_for_user_input()
    ):
        result = session.submit_user_message(msg)
        if result == "ignored":
            return [{"done": True}]
        return [{"message": "Message delivered to agent session."}, {"done": True}]

    if msg.upper().startswith("FEEDBACK:"):
        feedback = msg.split(":", 1)[1].strip()
        if not feedback:
            return [
                {"message": "Missing feedback text after FEEDBACK:"},
                {"done": True},
            ]
        if session.is_running():
            session.submit_runtime_feedback(feedback)
            return [
                {"message": "Feedback delivered to the running agent."},
                {"done": True},
            ]
        return [
            {"message": "No running agent session to receive feedback."},
            {"done": True},
        ]

    if msg and session.is_running():
        session.submit_runtime_feedback(msg)
        return [
            {
                "message": "Agent is running. Use FEEDBACK: <instruction> to redirect it, or STOP to interrupt."
            },
            {"done": True},
        ]

    return [{"message": f'Done! The task: "{msg}" is complete.'}, {"done": True}]


def _sse(items):
    def event_stream():
        for item in items:
            yield f"data: {json.dumps(item)}\\n\\n"

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


if __name__ == "__main__":
    start_websocket_server()
    app.run(host="0.0.0.0", port=5000)
