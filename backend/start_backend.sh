#!/bin/bash
# Start Flask backend for InterfaceAI

cd "$(dirname "$0")/app"

echo "🚀 Starting InterfaceAI Backend..."
echo "📍 API will be available at: http://localhost:5001"

if [ -z "$GOOGLE_API_KEY" ]; then
  echo "⚠️  GOOGLE_API_KEY (Gemini) is not set. LLM-powered features will use fallback logic where possible."
else
  echo "🔑 Using Gemini API (GOOGLE_API_KEY detected)"
fi
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"
echo ""

export PORT=5001
python main.py
