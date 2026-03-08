import json

from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from app.agent_execution import session
from app.extension_automation import is_server_running, send_command_sync, start_websocket_server

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.get("/health")
def health():
    return "ok", 200


@app.get("/api/extension/health")
def api_extension_health():
    running = is_server_running()
    status = "ok" if running else "error"
    message = "Extension WS server running" if running else "Extension WS server not started"
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
        message = (request.get_json(silent=True) or {}).get("message", "")
    else:
        message = request.args.get("message", "")

    msg = (message or "").strip()

    if msg.upper().startswith("GOAL:"):
        goal = msg.split(":", 1)[-1].strip()
        if not goal:
            return _sse([{"message": "Missing goal text after GOAL:"}, {"done": True}])

        session.start(goal)

        def stream_agent():
            for item in session.stream():
                if "message" in item:
                    yield {"message": item["message"]}
                if item.get("done"):
                    yield {"done": True}
                    break

        return _sse(stream_agent())

    if msg.upper() == "APPROVAL ON":
        session.set_require_approval(True)
        return _sse([{"message": "Approval mode: ON"}, {"done": True}])

    if msg.upper() == "APPROVAL OFF":
        session.set_require_approval(False)
        return _sse([{"message": "Approval mode: OFF"}, {"done": True}])

    if msg.upper() == "APPROVAL STATUS":
        status = "ON" if session.get_require_approval() else "OFF"
        return _sse([{"message": f"Approval mode: {status}"}, {"done": True}])

    if msg and (session.is_running() or session.is_waiting_for_approval()):
        session.submit_user_message(msg)
        return _sse([{"message": "Message delivered to agent session."}, {"done": True}])

    return _sse([{"message": f"Done! The task: \"{msg}\" is complete."}, {"done": True}])


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
