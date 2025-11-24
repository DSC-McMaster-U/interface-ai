from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from step_creator import create_steps
from flight_orchestrator import FlightOrchestrator, create_flight_orchestrator
from page_executor import PageExecutor

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:*", "chrome-extension://*"]}},
)

# Store active orchestrators by session
active_orchestrators = {}

# Store active orchestrators by session
active_orchestrators = {}


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


@app.route("/api/create-steps", methods=["POST"])
def api_create_steps():
    """Generate automation steps from user intent"""
    data = request.get_json(silent=True) or {}
    intent = data.get("intent", "").strip()
    
    if not intent:
        return jsonify({"error": "No intent provided"}), 400
    
    # Generate steps using the Step Creator
    steps = create_steps(intent)
    
    if not steps:
        return jsonify({"error": "Failed to generate steps"}), 500
    
    return jsonify({
        "intent": intent,
        "steps": steps,
        "count": len(steps)
    }), 200


@app.route("/api/flight/search", methods=["POST"])
def api_flight_search():
    """Autonomous flight search - finds best website and creates navigation plan"""
    data = request.get_json(silent=True) or {}
    intent = data.get("intent", "").strip()
    session_id = data.get("session_id", "default")
    
    if not intent:
        return jsonify({"error": "No intent provided"}), 400
    
    # Create flight orchestrator
    result = create_flight_orchestrator(intent)
    
    # Store orchestrator for this session
    orchestrator = FlightOrchestrator()
    orchestrator.process_flight_request(intent)
    active_orchestrators[session_id] = orchestrator
    
    return jsonify(result), 200


@app.route("/api/flight/extract", methods=["POST"])
def api_flight_extract():
    """Extract flight options from page content"""
    data = request.get_json(silent=True) or {}
    page_content = data.get("page_content", "")
    session_id = data.get("session_id", "default")
    screenshot_analysis = data.get("screenshot_analysis")
    
    orchestrator = active_orchestrators.get(session_id)
    if not orchestrator:
        orchestrator = FlightOrchestrator()
        active_orchestrators[session_id] = orchestrator
    
    flights = orchestrator.extract_flight_options_from_page(page_content, screenshot_analysis)
    
    return jsonify({
        "flights": flights,
        "count": len(flights)
    }), 200


@app.route("/api/flight/options", methods=["POST"])
def api_flight_options():
    """Get top flight options with recommendations"""
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", "default")
    count = data.get("count", 5)
    
    orchestrator = active_orchestrators.get(session_id)
    if not orchestrator:
        return jsonify({"error": "No active session"}), 400
    
    result = orchestrator.get_top_options(count)
    return jsonify(result), 200


@app.route("/api/flight/select", methods=["POST"])
def api_flight_select():
    """User selects a flight option"""
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", "default")
    flight_id = data.get("flight_id")
    
    if not flight_id:
        return jsonify({"error": "No flight_id provided"}), 400
    
    orchestrator = active_orchestrators.get(session_id)
    if not orchestrator:
        return jsonify({"error": "No active session"}), 400
    
    result = orchestrator.select_flight(flight_id)
    return jsonify(result), 200


@app.route("/api/page/analyze", methods=["POST"])
def api_page_analyze():
    """Analyze page screenshot for next actions"""
    data = request.get_json(silent=True) or {}
    screenshot_b64 = data.get("screenshot")
    context = data.get("context", "")
    
    if not screenshot_b64:
        return jsonify({"error": "No screenshot provided"}), 400
    
    executor = PageExecutor()
    analysis = executor.analyze_screenshot(screenshot_b64, context)
    
    return jsonify(analysis), 200


@app.route("/api/page/element", methods=["POST"])
def api_page_element():
    """Find element intelligently"""
    data = request.get_json(silent=True) or {}
    target = data.get("target", "")
    page_html = data.get("page_html", "")
    screenshot_analysis = data.get("screenshot_analysis")
    
    if not target:
        return jsonify({"error": "No target provided"}), 400
    
    executor = PageExecutor()
    element_info = executor.find_element_intelligently(target, page_html, screenshot_analysis)
    
    return jsonify(element_info), 200


@app.route("/api/page/script", methods=["POST"])
def api_page_script():
    """Generate execution script for a step"""
    data = request.get_json(silent=True) or {}
    step = data.get("step")
    element_info = data.get("element_info")
    
    if not step:
        return jsonify({"error": "No step provided"}), 400
    
    executor = PageExecutor()
    script = executor.create_execution_script(step, element_info)
    
    return jsonify({"script": script}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
