from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import json
import re

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


@app.route("/api/generate-steps", methods=["POST"])
def generate_steps():
    """
    Endpoint to generate automation steps using Gemini AI
    Expects: { "task": "post on Instagram" }
    Returns: { "success": true, "steps": [[["search", "instagram"], ["click", "login"]], ...] }
    """
    data = request.get_json(silent=True) or {}
    task = data.get("task", "").strip()
    
    if not task:
        return jsonify({
            "success": False,
            "message": "No task provided"
        }), 400
    
    print(f"\n[Backend] 🤖 Generating steps for task: '{task}'")
    
    try:
        import google.generativeai as genai
        
        # Configure Gemini
        GEMINI_API_KEY = "AIzaSyAcBF9LfX5Pa-zXdqYt7SBIJkemj4bTTuo"
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Create prompt
        prompt = f"""You are a web automation assistant. Break down the following task into simple automation steps.

Task: {task}

Available actions:
1. "search" - Search Google (param: search query)
2. "click" - Click a button/link (param: button text)
3. "fill" - Fill a textbox (param: "fieldname|value")

Return a 3D array where each step has multiple alternatives (fallbacks) in case the first option doesn't work.
Format: [[[action1, param1], [action1_fallback, param1_fallback]], [[action2, param2], [action2_fallback, param2_fallback]], ...]

Example for "post on Instagram":
[
  [["search", "instagram"], ["search", "instagram.com"]],
  [["click", "Create"], ["click", "New Post"], ["click", "+"]],
  [["click", "Select from computer"], ["click", "Upload"], ["click", "Choose file"]],
  [["click", "Next"], ["click", "Continue"], ["click", "Share"]],
  [["click", "Post"], ["click", "Share"], ["click", "Publish"]]
]

IMPORTANT: 
- Return ONLY the JSON array, no other text
- Each step should have 1-3 alternatives (fallbacks)
- Use simple, clear button/field names
- Be specific but flexible with alternatives

Now generate steps for: "{task}"
"""
        
        print("[Backend] 📤 Sending request to Gemini...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        print(f"[Backend] 📥 Gemini response: {response_text[:200]}...")
        
        # Remove markdown code blocks if present
        # Use regex to extract content between ```json and ``` or ``` and ```
        markdown_match = re.search(r'```(?:json)?\s*(.*?)\s*```', response_text, re.DOTALL)
        if markdown_match:
            response_text = markdown_match.group(1).strip()
            print(f"[Backend] 📋 Extracted from markdown: {response_text[:100]}...")
        
        # Extract JSON array from response
        # Find the first [[ and last ]]
        start_match = re.search(r'\[\s*\[', response_text)
        if start_match:
            start_pos = start_match.start()
            # Find the matching ]] at the end
            end_match = re.search(r'\]\s*\](?:\s*)$', response_text)
            if end_match:
                end_pos = end_match.end()
                json_text = response_text[start_pos:end_pos]
            else:
                # Try to find last ]]
                last_double_bracket = response_text.rfind(']]')
                if last_double_bracket != -1:
                    json_text = response_text[start_pos:last_double_bracket + 2]
                else:
                    json_text = response_text[start_pos:]
            
            print(f"[Backend] 🔍 Parsing JSON: {json_text[:150]}...")
            steps = json.loads(json_text)
        else:
            # Try parsing the entire response
            print(f"[Backend] 🔍 Parsing entire response as JSON...")
            steps = json.loads(response_text)
        
        print(f"[Backend] ✅ Generated {len(steps)} steps")
        for i, step in enumerate(steps):
            print(f"[Backend]   Step {i+1}: {step}")
        
        return jsonify({
            "success": True,
            "steps": steps,
            "task": task
        }), 200
        
    except ImportError:
        print("[Backend] ❌ Error: google-generativeai not installed")
        return jsonify({
            "success": False,
            "message": "Gemini AI library not installed. Run: pip install google-generativeai"
        }), 500
    except json.JSONDecodeError as e:
        print(f"[Backend] ❌ JSON parsing error: {e}")
        print(f"[Backend] Response was: {response_text}")
        return jsonify({
            "success": False,
            "message": f"Failed to parse AI response: {str(e)}"
        }), 500
    except Exception as e:
        print(f"[Backend] ❌ Error generating steps: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


if __name__ == "__main__":
    # Run in single-threaded mode so Playwright browser can be reused across requests
    # threaded=False ensures all requests are handled in the same thread
    print("[Backend] 🔧 Starting Flask in single-threaded mode for Playwright compatibility...")
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), threaded=False)
