import datetime
import os

# Compute date for file
today = datetime.date.today()
filename = f"raw-{today}.md"
path = f"documentation/meetings/raw-notes/{filename}"

template = f"""# Weekly Meeting Notes — {today}

## Attendees
- Person 1
- Person 2
- Person 3

## Updates
- 

## Discussion Topics
- 

## Decisions
- 

## Action Items
- [ ] Example: assign action items here
"""

# Ensure folder exists
os.makedirs("documentation/meetings/raw-notes", exist_ok=True)

with open(path, "w") as f:
    f.write(template)

print(f"Created: {path}")
