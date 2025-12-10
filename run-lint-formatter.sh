#!/bin/bash
set -e

echo "Formatting Python code with Black..."
black backend playwright vision-ai || { echo "Black formatting failed"; exit 1; }
echo "Python code formatted"
echo ""

echo "Linting Python code with Ruff..."
echo "  Checking backend..."
ruff check --fix backend || { echo "Backend linting failed"; exit 1; }
echo "  Checking playwright..."
ruff check --fix playwright || { echo "Playwright linting failed"; exit 1; }
echo "  Checking vision-ai..."
ruff check --fix vision-ai || { echo "Vision-AI linting failed"; exit 1; }
echo "Python linting passed"
echo ""

echo "Formatting JavaScript code with Prettier..."
cd frontend
npx prettier --write . || { echo "Prettier formatting failed"; exit 1; }
cd ..
echo "JavaScript code formatted"
echo ""

echo "Linting JavaScript code with ESLint..."
cd frontend/chrome-extension-react-template
npx eslint . --fix --ignore-pattern "build/**" || { echo "ESLint linting failed"; exit 1; }
cd ../..
echo "JavaScript linting passed"
echo ""