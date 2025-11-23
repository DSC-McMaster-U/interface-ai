import os
import glob
import datetime
import requests
import json

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash-lite"

# Find the latest raw note file
files = sorted(glob.glob("documentation/meetings/raw-notes/raw-*.md"))
latest_file = files[-1]

with open(latest_file, "r") as f:
    content = f.read()

prompt = f"""
Summarize this weekly meeting into:

1. High-level summary
2. Key decisions
3. Risks and blockers
4. Action items (keep as markdown checkboxes)

Meeting content:
{content}
"""

url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

data = {
    "contents": [{"parts": [{"text": prompt}]}]
}

response = requests.post(url, json=data)
resp_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]

# Create summary file
today = datetime.date.today()
outfile = f"documentation/meetings/summaries/summary-{today}.md"

os.makedirs("documentation/meetings/summaries", exist_ok=True)

with open(outfile, "w") as f:
    f.write(resp_text)

print(f"Created summary file: {outfile}")
