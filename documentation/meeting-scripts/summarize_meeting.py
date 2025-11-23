import os
import glob
import datetime
import requests

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash-lite"

# Find the latest raw note file (supports suffixes)
files = sorted(glob.glob("documentation/meetings/raw-notes/raw-*.md"))
latest_file = files[-1]   # newest alphabetically = latest version

# Extract the filename (e.g., raw-2025-11-23-a.md)
raw_filename = os.path.basename(latest_file)

# Derive the correct summary filename by replacing "raw-" with "summary-"
summary_filename = raw_filename.replace("raw-", "summary-")
summary_path = f"documentation/meetings/summaries/{summary_filename}"

# Read raw file content
with open(latest_file, "r") as f:
    content = f.read()

# Build the summarization prompt
prompt = f"""
Summarize this weekly meeting into:

1. High-level summary
2. Key decisions
3. Risks and blockers
4. Action items (keep EXACTLY as markdown checkboxes)

Meeting content:
{content}
"""

# Gemini API endpoint
url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

data = {
    "contents": [{"parts": [{"text": prompt}]}]
}

# Call Gemini model
response = requests.post(url, json=data)
resp_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]

# Ensure folder exists
os.makedirs("documentation/meetings/summaries", exist_ok=True)

# Save summary file
with open(summary_path, "w") as f:
    f.write(resp_text)

print(f"Created summary file: {summary_path}")
