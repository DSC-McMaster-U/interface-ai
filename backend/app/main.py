from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import os
import json
import time
import threading

from app.services import (
    vision_ai_health,
    vision_ai_analyze,
    playwright_health,
    playwright_navigate,
    playwright_click,
    playwright_fill,
)

app = Flask(__name__)
# Allow all origins in development for easier testing
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------------------------------------------------------------------------
# Vision-AI proxy / relay
# ---------------------------------------------------------------------------


@app.get("/api/vision/health")
def api_vision_health():
    """Check Vision-AI service health."""
    ok, msg = vision_ai_health()
    if ok:
        return jsonify({"status": "ok", "vision_ai": msg}), 200
    return jsonify({"status": "error", "vision_ai": msg}), 503


@app.post("/api/vision/analyze")
def api_vision_analyze():
    """Call Vision-AI POST /analyze. Body: { \"text\": \"...\" }."""
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    ok, result, err = vision_ai_analyze(text)
    if ok:
        return jsonify(result), 200
    return jsonify({"error": err, "detail": result}), 503


# ---------------------------------------------------------------------------
# Playwright proxy / relay
# ---------------------------------------------------------------------------


@app.get("/api/playwright/health")
def api_playwright_health():
    """Check Playwright service health."""
    ok, msg = playwright_health()
    if ok:
        return jsonify({"status": "ok", "playwright": msg}), 200
    return jsonify({"status": "error", "playwright": msg}), 503


@app.post("/api/playwright/navigate")
def api_playwright_navigate():
    """Call Playwright navigate. Body: { \"url\": \"https://...\" }."""
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "missing url"}), 400
    ok, result, err = playwright_navigate(url)
    if ok:
        return jsonify(result), 200
    return jsonify({"error": err, "detail": result}), 503


@app.post("/api/playwright/click")
def api_playwright_click():
    """Call Playwright click. Body: { \"text\": \"Submit\", \"exact\": false }."""
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    exact = data.get("exact", False)
    if not text:
        return jsonify({"error": "missing text"}), 400
    ok, result, err = playwright_click(text, exact=exact)
    if ok:
        return jsonify(result), 200
    return jsonify({"error": err, "detail": result}), 503


@app.post("/api/extension/command")
def api_extension_command():
    """
    Execute extension automation command. Body: { "action": "...", "params": {...} }.
    Requires extension connected via WebSocket (ws://localhost:7878).
    """
    from app.extension_automation import send_command_sync

    data = request.get_json(silent=True) or {}
    action = data.get("action", "").strip()
    params = data.get("params") or {}
    if not action:
        return jsonify({"error": "missing action"}), 400

    result = send_command_sync(action, params)
    return jsonify(result), 200


@app.post("/api/extension/screenshot")
def api_extension_screenshot():
    """
    Take screenshot via extension and optionally save. Body: { "path": "/tmp/screenshot.png" }.
    Returns { "success": true, "path": "..." } or { "success": false, "error": "..." }.
    """
    from app.extension_automation import send_command_sync

    data = request.get_json(silent=True) or {}
    save_path = data.get("path", "").strip()

    result = send_command_sync("screenshot", {})
    if not result.get("success") or "dataUrl" not in result:
        return jsonify(result), 503

    if save_path:
        import base64
        b64 = result["dataUrl"].split(",", 1)[-1] if "," in result["dataUrl"] else result["dataUrl"]
        with open(save_path, "wb") as f:
            f.write(base64.b64decode(b64))
        result["path"] = save_path
        print(f"[ExtensionAutomation] Screenshot saved to {save_path}")

    return jsonify(result), 200


@app.get("/api/extension/health")
def api_extension_health():
    """Check if extension WebSocket server is running (does not check if browser connected)."""
    from app.extension_automation import _loop

    return jsonify({
        "status": "ok" if _loop is not None else "error",
        "message": "Extension WS server running" if _loop else "Extension WS server not started",
    }), 200 if _loop else 503


@app.post("/api/playwright/fill")
def api_playwright_fill():
    """Call Playwright fill. Body: { \"field\": \"email\", \"value\": \"a@b.com\" }."""
    data = request.get_json(silent=True) or {}
    field = data.get("field", "").strip()
    value = data.get("value", "")
    if not field:
        return jsonify({"error": "missing field"}), 400
    ok, result, err = playwright_fill(field, value)
    if ok:
        return jsonify(result), 200
    return jsonify({"error": err, "detail": result}), 503


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return "ok", 200


@app.route("/api/relay", methods=["GET", "POST"])
def relay():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        message = data.get("message", "")
    else:
        message = request.args.get("message", "")

    if message.strip().lower() == "hello":
        from app.extension_automation import run_demo_sequence

        def run_demo():
            run_demo_sequence()

        t = threading.Thread(target=run_demo, daemon=True)
        t.start()

        def demo_stream():
            yield f"data: {json.dumps({'message': 'Triggered extension demo sequence.'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        return Response(
            stream_with_context(demo_stream()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )

    def main_logic_loop():
        # maintain overall actions array to track progress
        for i in range(5): # while not achieved_goal(get_state(message), message):
            # get_next_small_step(get_state(message))
                # natural language description of the small step (simple step like click a button, fill a form, etc.)
            # execute_small_step(get_state(message)) via content scripts method
                #basically use an "agent" llm to choose the best content script function to call based on small step description 
                # it outputs it as a proeprly formatted json and we use that to call the function
                # if step was successful, continue to next step in loop
                # ELSE: try vision-ai / vla to output the coordinates of the element to click, and click it

            msg = f"Step {i+1}: Processing '{message}'..."
            
            # format as SSE (Server-Sent Events)
            yield f"data: {json.dumps({'message': msg})}\n\n"
            time.sleep(0.5)
        
        done_msg = f'Done! The task: "{message}" is complete.'
        yield f"data: {json.dumps({'message': done_msg})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    
    # return SSE stream
    return Response(
        stream_with_context(main_logic_loop()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
        }
    )


def _start_extension_and_demo():
    from app.extension_automation import start_websocket_server, run_demo_sequence

    start_websocket_server()
    if os.getenv("RUN_EXTENSION_DEMO", "true").lower() in ("1", "true", "yes"):
        def run_demo():
            run_demo_sequence()

        t = threading.Thread(target=run_demo, daemon=True)
        t.start()


if __name__ == "__main__":
    _start_extension_and_demo()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
