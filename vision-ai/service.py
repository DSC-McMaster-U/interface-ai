from flask import Flask, request, jsonify
import os
import base64
import tempfile
import uuid
import time
from pipeline import find_element_unified

app = Flask(__name__)


@app.get("/health")
def health():
    return "ok", 200


@app.post("/find_element")
def find_element():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400
        
    query = payload.get("query")
    image_data = payload.get("image")
    
    if not query or not image_data:
        return jsonify({"error": "Both 'query' and 'image' (base64) are required"}), 400

    # Strip data URI prefix if present
    if "base64," in image_data:
        image_data = image_data.split("base64,")[1]
        
    try:
        # Decode base64 to temp file
        img_bytes = base64.b64decode(image_data)
        
        # Determine format (usually JPEG or PNG from extension format)
        is_png = image_data.startswith("iVBORw0KGgo")
        ext = ".png" if is_png else ".jpg"
        
        # Save to a temporary file since `find_element_unified` expects a file path
        # In a high-traffic production app, pipeline.py should be refactored to accept in-memory np bytes/PIL images
        temp_filename = os.path.join(tempfile.gettempdir(), f"vision_req_{uuid.uuid4().hex}{ext}")
        with open(temp_filename, "wb") as f:
            f.write(img_bytes)
            
        # Run vision pipeline
        boxes, duration = find_element_unified(temp_filename, query)
        
        # Clean up temp file
        try:
            os.remove(temp_filename)
        except:
            pass
            
        # Format response
        result = {
            "success": len(boxes) > 0,
            "matches": len(boxes),
            "inference_time_seconds": round(duration, 3),
            "boxes": boxes  # List of [x1, y1, x2, y2]
        }
        
        # Standardize center coordinates if exactly one match
        if len(boxes) == 1:
            x1, y1, x2, y2 = boxes[0]
            result["center"] = {
                "x": int((x1 + x2) / 2),
                "y": int((y1 + y2) / 2)
            }
            
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 6000)))
