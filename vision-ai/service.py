import os

from flask import Flask, jsonify, request

app = Flask(__name__)


@app.get("/health")
def health():
    return "ok", 200


@app.post("/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "")
    return jsonify({"length": len(text), "service": "vision-ai"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 6000)))
