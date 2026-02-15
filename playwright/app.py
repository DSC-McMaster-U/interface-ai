"""
Minimal HTTP API for Playwright ActionExecutor so the backend can call it.
Endpoints: GET /health, POST /navigate, POST /click, POST /fill, POST /close.
"""

import os
from threading import Lock

from flask import Flask, request, jsonify

from action_executor import ActionExecutor

app = Flask(__name__)

_executor: ActionExecutor | None = None
_lock = Lock()
_headless = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() in ("1", "true", "yes")


def _get_executor() -> ActionExecutor | None:
    global _executor
    with _lock:
        return _executor


def _set_executor(ex: ActionExecutor | None) -> None:
    global _executor
    with _lock:
        _executor = ex


@app.get("/health")
def health():
    return "ok", 200


@app.post("/navigate")
def navigate():
    """Body: { "url": "https://..." }. Starts browser if needed and navigates."""
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "missing url"}), 400
    ex = _get_executor()
    try:
        if ex is None:
            ex = ActionExecutor(headless=_headless)
            ex.start(url=url)
            _set_executor(ex)
        else:
            ex.navigate_to(url)
        return jsonify({"ok": True, "url": url, "title": ex.page.title()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/click")
def click():
    """Body: { "text": "Submit", "exact": false }. Clicks button/link by text."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    exact = data.get("exact", False)
    if not text:
        return jsonify({"error": "missing text"}), 400
    ex = _get_executor()
    if ex is None or ex.page is None:
        return jsonify({"error": "browser not started; call POST /navigate first"}), 400
    try:
        if exact:
            ok = ex.click_button_by_exact_match(text)
        else:
            ok = ex.click_button_by_text(text)
        return jsonify({"ok": ok, "text": text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/fill")
def fill():
    """Body: { "field": "email", "value": "a@b.com" }."""
    data = request.get_json(silent=True) or {}
    field = (data.get("field") or "").strip()
    value = data.get("value", "")
    if not field:
        return jsonify({"error": "missing field"}), 400
    ex = _get_executor()
    if ex is None or ex.page is None:
        return jsonify({"error": "browser not started; call POST /navigate first"}), 400
    try:
        ok = ex.fill_input_field(field, value)
        return jsonify({"ok": ok, "field": field}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/close")
def close():
    """Close the browser. Next /navigate will start a new one."""
    ex = _get_executor()
    if ex is not None:
        try:
            ex.stop()
        except Exception:
            pass
        _set_executor(None)
    return jsonify({"ok": True}), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 7000))
    app.run(host="0.0.0.0", port=port)
