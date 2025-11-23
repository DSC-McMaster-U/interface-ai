import os
import glob
import datetime
import requests
import re

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash-lite"

# ---- FIXED SORTING LOGIC ----
def extract_sort_key(path):
    name = os.path.basename(path)
    match = re.match(r"raw-(\d{4}-\d{2}-\d{2})(?:-([a-z]))?\.md", name)
    if not match:
        return ("0000-00-00", "")
    date_str, suffix = match.groups()
    suffix = suffix or ""  # treat raw-YYYY-MM-DD.md as suffix ""
    return (date_str, suffix)

files = glob.glob("documentation/meetings/raw-notes/raw-*.md")
files_sorted = sorted(files, key=extract_sort_key)
latest_file = files_sorted[-1]

# Extract suffix from raw file
raw_filename = os.path.basename(latest_file)
summary_filename = raw_filename.replace("raw-", "summary-")
summary_path = f"documentation/meetings/summaries/{summary_filename}"

# Read raw content
with open(latest_file, "r") as f:
    content = f.read()

prompt = f"""
Summarize this weekly meeting into:

1. High-level summary
2. Key decisions
3. Risks and blockers
4. Action items (keep EXACTLY as markdown checkboxes)

Meeting content:
{content}
"""

url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
data = {"contents": [{"parts": [{"text": prompt}]}]}
response = requests.post(url, json=data)
resp_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]

os.makedirs("documentation/meetings/summaries", exist_ok=True)
with open(summary_path, "w") as f:
    f.write(resp_text)

print(f"Created summary file: {summary_path}")
