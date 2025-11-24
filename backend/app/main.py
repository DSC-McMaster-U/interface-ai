from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

# Add playwright directory to path for importing action_executor
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "playwright"))

try:
    from action_executor import ActionExecutor
    PLAYWRIGHT_AVAILABLE = True
    print("[Backend] ActionExecutor imported successfully")
except ImportError as e:
    PLAYWRIGHT_AVAILABLE = False
    print(f"[Backend] Warning: Could not import ActionExecutor: {e}")

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:*", "chrome-extension://*"]}},
)

# Global browser sessions - keyed by session ID
browser_sessions = {}


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
    return jsonify({"echo": f"Hello {message}", "from": "backend"}), 200


@app.route("/api/click-button", methods=["POST"])
def click_button():
    """
    Endpoint to handle button click requests from Chrome extension using Playwright
    
    Request body:
        {
            "buttonText": "Submit",
            "url": "https://example.com"
        }
    
    Response:
        {
            "success": true,
            "message": "Button clicked successfully",
            "buttonText": "Submit",
            "found": true,
            "elementTag": "BUTTON",
            "elementText": "Submit Form"
        }
    """
    data = request.get_json(silent=True) or {}
    button_text = data.get("buttonText", "").strip()
    url = data.get("url", "").strip()
    session_id = data.get("sessionId", "default")  # Get session ID from frontend
    
    if not button_text:
        print("[Backend] ❌ Error: No button text provided")
        return jsonify({
            "success": False,
            "message": "No button text provided",
            "found": False
        }), 400
    
    if not url:
        print("[Backend] ❌ Error: No URL provided")
        return jsonify({
            "success": False,
            "message": "No URL provided",
            "found": False
        }), 400
    
    if not PLAYWRIGHT_AVAILABLE:
        print("[Backend] ❌ Error: Playwright ActionExecutor not available")
        return jsonify({
            "success": False,
            "message": "Playwright ActionExecutor not available. Install requirements.",
            "found": False
        }), 500
    
    # Log the button click request
    print(f"\n[Backend] 🎯 Received button click request")
    print(f"[Backend]    Button text: '{button_text}'")
    print(f"[Backend]    URL: {url}")
    print(f"[Backend]    Session ID: {session_id}")
    
    global browser_sessions
    
    try:
        # Check if we have an existing session
        if session_id in browser_sessions:
            executor = browser_sessions[session_id]
            print(f"[Backend] 🔄 Reusing existing session: {session_id}")
            
            # Navigate to URL in same tab (same page object)
            print(f"[Backend] 🌐 Navigating to {url} in same tab...")
            executor.navigate_to(url)
            print(f"[Backend] 📄 Navigated to: {executor.page.title()}")
        else:
            # Create new session
            print(f"[Backend] 🚀 Creating NEW browser session: {session_id}")
            executor = ActionExecutor(headless=False)
            executor.start(url=url)  # Creates browser with first page
            browser_sessions[session_id] = executor
            print(f"[Backend] 📄 New session loaded: {executor.page.title()}")
        
        # Get the executor for this session
        executor = browser_sessions[session_id]
        
        # Attempt to click the button
        print(f"[Backend] 🔍 Searching for button: '{button_text}'")
        success = executor.click_button_by_text(button_text)
        
        if success:
            # Button was found and clicked
            print(f"[Backend] ✅ Button FOUND and clicked: '{button_text}'")
            response = {
                "success": True,
                "message": f"Button '{button_text}' clicked successfully",
                "buttonText": button_text,
                "found": True,
                "url": url,
                "pageTitle": executor.page.title()
            }
        else:
            # Button was not found
            print(f"[Backend] ❌ Button NOT FOUND: '{button_text}'")
            response = {
                "success": False,
                "message": f"Button '{button_text}' not found on page",
                "buttonText": button_text,
                "found": False,
                "url": url,
                "pageTitle": executor.page.title()
            }
        
        # Wait a moment to see the result
        import time
        time.sleep(2)
        
        print(f"[Backend] 📤 Sending response: {response}")
        print(f"[Backend] 🌐 Browser staying open for continued interaction...")
        
        # Add session ID to response so frontend can reuse it
        response["sessionId"] = session_id
        return jsonify(response), 200 if success else 404
        
    except Exception as e:
        print(f"[Backend] ❌ Error processing button click: {e}")
        import traceback
        traceback.print_exc()
        
        # Keep browser open even on error - user can try again
        print(f"[Backend] 🌐 Browser staying open despite error...")
        
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}",
            "found": False,
            "buttonText": button_text
        }), 500
        
    # Browser stays open and is reused across requests!
    # To close browser: restart the Flask server (Ctrl+C)


@app.route("/api/close-browser", methods=["POST"])
def close_browser():
    """
    Endpoint to close a specific browser session or all sessions
    """
    data = request.get_json(silent=True) or {}
    session_id = data.get("sessionId", "all")
    
    global browser_sessions
    
    if session_id == "all":
        print("[Backend] 🧹 Closing ALL browser sessions...")
        for sid, executor in browser_sessions.items():
            try:
                executor.stop()
                print(f"[Backend] ✅ Closed session: {sid}")
            except Exception as e:
                print(f"[Backend] ⚠️ Error closing session {sid}: {e}")
        browser_sessions.clear()
        print("[Backend] ✅ All browser sessions closed")
    else:
        if session_id in browser_sessions:
            try:
                print(f"[Backend] 🧹 Closing browser session: {session_id}")
                browser_sessions[session_id].stop()
                del browser_sessions[session_id]
                print(f"[Backend] ✅ Session {session_id} closed")
            except Exception as e:
                print(f"[Backend] ⚠️ Error closing session {session_id}: {e}")
        else:
            print(f"[Backend] ⚠️ Session {session_id} not found")
    
    return jsonify({
        "success": True,
        "message": f"Browser session(s) closed: {session_id}",
        "activeSessions": list(browser_sessions.keys())
    }), 200


if __name__ == "__main__":
    # Run in single-threaded mode so Playwright browser can be reused across requests
    # threaded=False ensures all requests are handled in the same thread
    print("[Backend] 🔧 Starting Flask in single-threaded mode for Playwright compatibility...")
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), threaded=False)
