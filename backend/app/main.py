from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import os
import json
import time

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
        
        yield f"data: {json.dumps({'message': f'Done! The task: "{message}" is complete.'})}\n\n"
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
