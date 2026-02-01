from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import os
import json
import time

app = Flask(__name__)
# Allow all origins in development for easier testing
CORS(app, resources={r"/*": {"origins": "*"}})

# easily call python functions in other folders like vision-ai, playwright, etc. by using invoking their api endpoints

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
