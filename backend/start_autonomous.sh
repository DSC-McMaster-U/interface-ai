#!/bin/bash

# InterfaceAI - Autonomous Flight Booking Startup Script

echo "🚀 Starting InterfaceAI Autonomous Flight Booking System"
echo "=========================================================="

# Check if GOOGLE_API_KEY is set (Gemini)
if [ -z "$GOOGLE_API_KEY" ]; then
    echo "⚠️  Warning: GOOGLE_API_KEY (Gemini) environment variable is not set"
    echo "    Some autonomous features will fall back to pattern-based logic."
else
    echo "✓ GOOGLE_API_KEY detected (Gemini)"
fi

# Check if Python dependencies are installed
echo ""
echo "Checking dependencies..."

python3 -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Flask not installed. Installing dependencies..."
    pip3 install -r requirements.txt
fi

python3 -c "import google.generativeai" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ google-generativeai not installed. Installing..."
    pip3 install google-generativeai
fi

echo "✓ All dependencies installed"

# Start the backend server
echo ""
echo "🔥 Starting Flask backend on port 5001..."
echo ""
echo "Backend will be available at: http://localhost:5001"
echo "Health check: http://localhost:5001/health"
echo ""
echo "Available endpoints:"
echo "  POST /api/flight/search    - Start autonomous flight search"
echo "  POST /api/flight/extract   - Extract flight options"
echo "  POST /api/flight/options   - Get ranked options"
echo "  POST /api/flight/select    - User selects flight"
echo "  POST /api/page/analyze     - Analyze screenshot"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd "$(dirname "$0")"
export FLASK_APP=app/main.py
export FLASK_ENV=development
export PORT=5001

python3 -m flask run --host=0.0.0.0 --port=5001
