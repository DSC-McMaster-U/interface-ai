import datetime
import os
import glob
import string

# Compute date for today
today = datetime.date.today()
date_str = str(today)

# Base filename (no suffix)
base_filename = f"raw-{date_str}.md"
base_path = f"documentation/meetings/raw-notes/{base_filename}"

# Check if base file exists
if not os.path.exists(base_path):
    filename = base_filename
else:
    # Find all variations like raw-2025-11-23-a.md
    pattern = f"documentation/meetings/raw-notes/raw-{date_str}-*.md"
    existing = sorted(glob.glob(pattern))

    if not existing:
        # First suffix is 'a'
        filename = f"raw-{date_str}-a.md"
    else:
        # Extract last suffix and increment
        last_file = existing[-1]  # e.g. raw-2025-11-23-c.md
        last_suffix = last_file.split("-")[-1].replace(".md", "")  # e.g. "c"

        # Next letter
        next_suffix = string.ascii_lowercase[string.ascii_lowercase.index(last_suffix) + 1]
        filename = f"raw-{date_str}-{next_suffix}.md"

path = f"documentation/meetings/raw-notes/{filename}"

template = f"""# Weekly Meeting Notes — {today}

## Attendees
- Person 1
- Person 2

## Updates
-

## Discussion Topics
-

## Decisions
-

## Action Items
- [ ] Example action item
"""

# Ensure folder exists
os.makedirs("documentation/meetings/raw-notes", exist_ok=True)

with open(path, "w") as f:
    f.write(template)

print(f"Created: {path}")
