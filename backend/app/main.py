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
        GEMINI_API_KEY = "AIzaSyAUSeBb4bjn_Y5lx6F1rpL3uoh7W_fLQIU"
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


@app.route("/api/generate-replacement-step", methods=["POST"])
def generate_replacement_step():
    """
    Endpoint to generate a replacement step when original fails
    Uses page context (available buttons/fields) to generate better step
    """
    data = request.get_json(silent=True) or {}
    goal = data.get("goal", "").strip()
    tried_alternatives = data.get("triedAlternatives", [])
    page_elements = data.get("pageElements", {})
    
    if not goal:
        return jsonify({
            "success": False,
            "message": "No goal provided"
        }), 400
    
    print(f"\n[Backend] 🔄 Generating replacement step for goal: '{goal}'")
    print(f"[Backend] Tried alternatives: {tried_alternatives}")
    print(f"[Backend] Available buttons: {page_elements.get('buttons', [])[:5]}")
    print(f"[Backend] Available links: {page_elements.get('links', [])[:5]}")
    print(f"[Backend] Available textboxes: {page_elements.get('textboxes', [])[:5]}")
    
    try:
        import google.generativeai as genai
        
        # Configure Gemini
        GEMINI_API_KEY = "AIzaSyAcBF9LfX5Pa-zXdqYt7SBIJkemj4bTTuo"
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Create prompt with page context
        buttons_list = ", ".join([f'"{b}"' for b in page_elements.get("buttons", [])[:15]])
        textboxes_list = ", ".join([f'"{t}"' for t in page_elements.get("textboxes", [])[:15]])
        links_list = ", ".join([f'"{l}"' for l in page_elements.get("links", [])[:15]])
        
        # Combine buttons and links as clickable elements
        clickable_elements = list(page_elements.get("buttons", [])[:15]) + list(page_elements.get("links", [])[:15])
        clickable_list = ", ".join([f'"{c}"' for c in clickable_elements[:20]])
        
        tried_str = "\n".join([f"  - {alt[0]}: {alt[1]}" for alt in tried_alternatives])
        
        prompt = f"""A web automation step failed. Generate a NEW replacement step with 2-3 alternatives based on what's ACTUALLY available on the page.

**Original Goal:** {goal}

**What Was Tried (ALL FAILED):**
{tried_str}

**Available Elements on Current Page:**
- Clickable elements (buttons + links): {clickable_list}
- Text input fields: {textboxes_list}

**Available Actions:**
- "click" - Click button/link/anchor (param: element text)
  NOTE: Links (<a> tags) are clickable just like buttons!
- "fill" - Fill textbox (param: "fieldname|value")
- "search" - Google search (param: search query)

Generate a SINGLE replacement step as a 2D array with 2-3 alternatives that use ONLY elements from the available list above.
DO NOT repeat the failed alternatives. Try different element names from the clickable elements or text fields list.

Format: [["action", "param"], ["action", "param"], ["action", "param"]]

Example if goal is "create post" and clickable elements include ["New", "Post", "Share", "Create link"]:
[["click", "New"], ["click", "Create link"], ["click", "Post"]]

IMPORTANT:
- Return ONLY the JSON array, no other text
- Use ONLY elements from the available lists above
- Links can be clicked just like buttons
- 2-3 alternatives maximum
- Don't repeat what already failed

Generate replacement step:
"""
        
        print("[Backend] 📤 Sending request to Gemini...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        print(f"[Backend] 📥 Gemini response: {response_text[:200]}...")
        
        # Remove markdown code blocks if present
        markdown_match = re.search(r'```(?:json)?\s*(.*?)\s*```', response_text, re.DOTALL)
        if markdown_match:
            response_text = markdown_match.group(1).strip()
            print(f"[Backend] 📋 Extracted from markdown: {response_text[:100]}...")
        
        # Extract JSON array
        start_match = re.search(r'\[\s*\[', response_text)
        if start_match:
            start_pos = start_match.start()
            end_match = re.search(r'\]\s*\](?:\s*)$', response_text)
            if end_match:
                end_pos = end_match.end()
                json_text = response_text[start_pos:end_pos]
            else:
                last_double_bracket = response_text.rfind(']]')
                if last_double_bracket != -1:
                    json_text = response_text[start_pos:last_double_bracket + 2]
                else:
                    json_text = response_text[start_pos:]
            
            print(f"[Backend] 🔍 Parsing JSON: {json_text[:150]}...")
            replacement_step = json.loads(json_text)
        else:
            replacement_step = json.loads(response_text)
        
        print(f"[Backend] ✅ Generated replacement step: {replacement_step}")
        
        return jsonify({
            "success": True,
            "step": replacement_step,
            "goal": goal
        }), 200
        
    except ImportError:
        print("[Backend] ❌ Error: google-generativeai not installed")
        return jsonify({
            "success": False,
            "message": "Gemini AI library not installed"
        }), 500
    except json.JSONDecodeError as e:
        print(f"[Backend] ❌ JSON parsing error: {e}")
        print(f"[Backend] Response was: {response_text}")
        return jsonify({
            "success": False,
            "message": f"Failed to parse AI response: {str(e)}"
        }), 500
    except Exception as e:
        print(f"[Backend] ❌ Error generating replacement step: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


@app.route("/api/verify-goal", methods=["POST"])
def verify_goal():
    """
    Endpoint to verify if the original goal has been achieved
    If not, generates continuation steps to complete the goal
    """
    data = request.get_json(silent=True) or {}
    original_goal = data.get("originalGoal", "").strip()
    page_content = data.get("pageContent", {})
    completed_steps = data.get("completedSteps", [])
    
    if not original_goal:
        return jsonify({
            "success": False,
            "message": "No original goal provided"
        }), 400
    
    print(f"\n[Backend] 🎯 Verifying goal completion: '{original_goal}'")
    print(f"[Backend] Page title: {page_content.get('title', 'N/A')}")
    print(f"[Backend] Page URL: {page_content.get('url', 'N/A')}")
    print(f"[Backend] Completed {len(completed_steps)} steps")
    print(f"[Backend] Available buttons: {page_content.get('buttons', [])[:5]}")
    print(f"[Backend] Available links: {page_content.get('links', [])[:5]}")
    
    try:
        import google.generativeai as genai
        
        # Configure Gemini
        GEMINI_API_KEY = "AIzaSyAcBF9LfX5Pa-zXdqYt7SBIJkemj4bTTuo"
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Prepare page content summary
        headings = ", ".join([f'"{h}"' for h in page_content.get("headings", [])[:10]])
        visible_text = "\n  - ".join(page_content.get("visibleText", [])[:20])
        buttons = ", ".join([f'"{b}"' for b in page_content.get("buttons", [])[:15]])
        links = ", ".join([f'"{l}"' for l in page_content.get("links", [])[:15]])
        textboxes = ", ".join([f'"{t}"' for t in page_content.get("textboxes", [])[:15]])
        
        # Combine buttons and links as clickable elements
        clickable_elements = list(page_content.get("buttons", [])[:15]) + list(page_content.get("links", [])[:15])
        clickable_list = ", ".join([f'"{c}"' for c in clickable_elements[:25]])
        
        # Format completed steps
        steps_summary = "\n".join([
            f"  {i+1}. {step[0]}: {step[1]}" 
            for i, step in enumerate(completed_steps[:10])
        ])
        
        prompt = f"""You are evaluating whether a web automation goal has been achieved.

**Original Goal:** {original_goal}

**Steps Completed:**
{steps_summary}

**Current Page State:**
- Title: {page_content.get('title', 'Unknown')}
- URL: {page_content.get('url', 'Unknown')}
- Headings: {headings}
- Visible Text (sample):
  - {visible_text}
- Clickable elements (buttons + links): {clickable_list}
- Text input fields: {textboxes}

**Your Task:**
1. Analyze if the original goal "{original_goal}" has been ACHIEVED based on the page content
2. Look for success indicators: confirmation messages, completion text, redirects to success pages
3. If ACHIEVED: Return {{"achieved": true, "steps": []}}
4. If NOT ACHIEVED: Generate 2-5 additional steps to complete the goal

**Available Actions:**
- "click" - Click button/link/anchor (param: element text)
  NOTE: Links (<a> tags) can be clicked just like buttons!
- "fill" - Fill textbox (param: "fieldname|value")
- "search" - Google search (param: search query)

**Response Format (JSON only):**
{{
  "achieved": true/false,
  "reason": "Brief explanation of why achieved or not",
  "steps": [
    [["action", "param"], ["action", "param"]],
    [["action", "param"]]
  ]
}}

**Important:**
- Return ONLY valid JSON, no other text
- If achieved, steps array should be empty []
- If not achieved, generate 2-5 continuation steps as 3D array (with fallback alternatives)
- Use ONLY elements from the clickable elements and text fields lists above
- Links (<a> tags) are clickable - treat them like buttons
- Be realistic about what's possible based on page content

Evaluate now:
"""
        
        print("[Backend] 📤 Sending verification request to Gemini...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        print(f"[Backend] 📥 Gemini response: {response_text[:300]}...")
        
        # Remove markdown code blocks if present
        markdown_match = re.search(r'```(?:json)?\s*(.*?)\s*```', response_text, re.DOTALL)
        if markdown_match:
            response_text = markdown_match.group(1).strip()
            print(f"[Backend] 📋 Extracted from markdown")
        
        # Parse JSON response
        result = json.loads(response_text)
        
        achieved = result.get("achieved", False)
        reason = result.get("reason", "")
        continuation_steps = result.get("steps", [])
        
        print(f"[Backend] Goal achieved: {achieved}")
        print(f"[Backend] Reason: {reason}")
        if not achieved:
            print(f"[Backend] Generated {len(continuation_steps)} continuation steps")
        
        return jsonify({
            "success": True,
            "achieved": achieved,
            "reason": reason,
            "steps": continuation_steps,
            "originalGoal": original_goal
        }), 200
        
    except ImportError:
        print("[Backend] ❌ Error: google-generativeai not installed")
        return jsonify({
            "success": False,
            "message": "Gemini AI library not installed"
        }), 500
    except json.JSONDecodeError as e:
        print(f"[Backend] ❌ JSON parsing error: {e}")
        print(f"[Backend] Response was: {response_text}")
        return jsonify({
            "success": False,
            "message": f"Failed to parse AI response: {str(e)}"
        }), 500
    except Exception as e:
        print(f"[Backend] ❌ Error verifying goal: {e}")
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

