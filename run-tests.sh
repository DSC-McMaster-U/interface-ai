#!/bin/bash

set -e

echo "Running backend tests..."
cd backend
pytest tests/ || { echo "Backend tests failed"; exit 1; }
cd ..
echo "Backend tests passed"
echo ""

echo "Running playwright tests..."
cd playwright
pytest tests/ || { echo "Playwright tests failed"; exit 1; }
cd ..
echo "Playwright tests passed"
echo ""

echo "Running vision-ai tests..."
cd vision-ai
pytest tests/ || { echo "Vision-AI tests failed"; exit 1; }
cd ..
echo "Vision-AI tests passed"
echo ""

echo "Running frontend tests..."
cd frontend
npm test || { echo "Frontend tests failed"; exit 1; }
cd ..
echo "Frontend tests passed"
echo ""
