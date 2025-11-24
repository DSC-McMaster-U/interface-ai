# Full Auto Feature Guide 🤖

## Overview

The **Full Auto** feature uses Gemini AI to automatically break down complex tasks into executable automation steps. It generates a sequence of actions with fallback alternatives, displays them for review/editing, and executes them automatically.

## How It Works

```
User enters task → Gemini AI generates steps → User reviews/edits → Execute with fallbacks
```

### Example Flow

**Input:** "post on Instagram"

**AI Generates:**
```json
[
  [["search", "instagram"], ["search", "instagram.com"]],
  [["click", "Create"], ["click", "New Post"], ["click", "+"]],
  [["click", "Select from computer"], ["click", "Upload"]],
  [["click", "Next"], ["click", "Continue"]],
  [["click", "Post"], ["click", "Share"]]
]
```

**Execution:**
- Step 1: Try "search instagram", if fails try "search instagram.com"
- Step 2: Try "click Create", if fails try "click New Post", if fails try "click +"
- And so on...

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `google-generativeai` - For Gemini AI API
- Other Flask dependencies

### 2. Start Backend

```bash
cd backend
python app/main.py
```

Backend will start on `http://localhost:5000`

### 3. Load Extension

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `frontend` folder
5. Refresh any open tabs

## Usage

### Step 1: Enter Task

In the extension popup, type a complex task:
- "post on Instagram"
- "book a flight to NYC"
- "order pizza online"
- "send email to john@example.com"

### Step 2: Click Full Auto Button

Click the purple **"🤖 Full Auto (AI)"** button.

The AI will:
1. Analyze your task
2. Break it into steps
3. Generate fallback alternatives for each step
4. Return the step sequence

### Step 3: Review Generated Steps

Steps appear in a nice UI showing:
- **Step number**
- **Action type** (search, click, fill)
- **Parameter** (editable input field)
- **Fallback alternatives** (marked with "(fallback)")
- **Delete button** for each step

### Step 4: Edit Steps (Optional)

You can:
- **Edit parameters**: Click on any input field and modify the text
- **Delete steps**: Click the red "Delete" button
- **Review alternatives**: See all fallback options

Example edits:
- Change "Create" to "New"
- Change "email" to "username"
- Add more specific button text

### Step 5: Execute

Click the green **"▶ Execute All"** button.

The extension will:
1. Try each step sequentially
2. For each step, try alternatives until one succeeds
3. Show progress: "Step 1/5..."
4. Report success or failure

## Step Format

### 3D Array Structure

```json
[
  [                           // Step 1
    ["action", "param"],      // Primary attempt
    ["action", "param"]       // Fallback 1
  ],
  [                           // Step 2
    ["action", "param"],      // Primary attempt
    ["action", "param"],      // Fallback 1
    ["action", "param"]       // Fallback 2
  ]
]
```

### Available Actions

1. **search** - Search Google and click first result
   ```json
   ["search", "instagram"]
   ```

2. **click** - Click a button/link by text
   ```json
   ["click", "Submit"]
   ```

3. **fill** - Fill a textbox
   ```json
   ["fill", "email|test@test.com"]
   ```
   Format: `"fieldname|value"`

## Examples

### Example 1: Post on Instagram

**Task:** `post on Instagram`

**Generated Steps:**
```json
[
  [["search", "instagram"], ["search", "instagram login"]],
  [["click", "Create"], ["click", "New Post"], ["click", "+"]],
  [["click", "Select from computer"], ["click", "Upload photo"]],
  [["click", "Next"], ["click", "Continue"]],
  [["click", "Post"], ["click", "Share"], ["click", "Publish"]]
]
```

### Example 2: Send Email

**Task:** `send email to john@example.com`

**Generated Steps:**
```json
[
  [["search", "gmail"], ["search", "google mail"]],
  [["click", "Compose"], ["click", "New Message"], ["click", "Write"]],
  [["fill", "to|john@example.com"], ["fill", "recipient|john@example.com"]],
  [["fill", "subject|Hello"], ["fill", "subject line|Hello"]],
  [["click", "Send"], ["click", "Submit"]]
]
```

### Example 3: Book Flight

**Task:** `book a flight to NYC`

**Generated Steps:**
```json
[
  [["search", "google flights"], ["search", "flights to NYC"]],
  [["click", "Search flights"], ["click", "Find flights"]],
  [["fill", "destination|NYC"], ["fill", "to|New York"]],
  [["click", "Search"], ["click", "Find"]],
  [["click", "Select"], ["click", "Choose"], ["click", "Book"]]
]
```

## Features

### ✅ AI-Powered Step Generation
- Gemini 2.0 Flash analyzes your task
- Generates logical step sequence
- Provides multiple alternatives per step

### ✅ Fallback System
- Each step has 1-3 alternatives
- Tries alternatives in order until one succeeds
- Robust to UI variations across websites

### ✅ Editable Steps
- Review before execution
- Edit any parameter inline
- Delete unnecessary steps
- Full control over automation

### ✅ Visual Feedback
- Clear step-by-step display
- Progress indicator during execution
- Color-coded status messages
- Highlights elements being interacted with

### ✅ Error Handling
- Stops on failure with clear message
- Shows which step failed
- Allows retry after manual fix

## Technical Details

### Backend API

**Endpoint:** `POST /api/generate-steps`

**Request:**
```json
{
  "task": "post on Instagram"
}
```

**Response:**
```json
{
  "success": true,
  "steps": [
    [["search", "instagram"]],
    [["click", "Create"], ["click", "New Post"]]
  ],
  "task": "post on Instagram"
}
```

### Gemini Configuration

- **Model:** `gemini-2.0-flash-exp`
- **API Key:** Configured in backend
- **Prompt:** Optimized for web automation tasks

### Frontend Execution

1. **Sequential Processing**: Steps execute one at a time
2. **Fallback Logic**: Tries alternatives until success
3. **Delay Between Steps**: 500ms pause for UI updates
4. **Content Script Integration**: Uses existing click/fill/search actions

## Troubleshooting

### "Gemini AI library not installed"

**Solution:**
```bash
cd backend
pip install google-generativeai
```

### Steps Don't Match Website

**Solution:**
1. Review generated steps
2. Edit button/field names to match actual website
3. Use browser DevTools to inspect element text
4. Add more specific alternatives

### Execution Fails at Step X

**Solutions:**
- Check if element exists on page
- Try editing the parameter text
- Add more fallback alternatives
- Ensure page is fully loaded

### API Key Error

**Solution:**
- Check API key in `backend/app/main.py` line 241
- Get new key from: https://makersuite.google.com/app/apikey
- Replace `GEMINI_API_KEY` value

## Best Practices

### 1. Be Specific with Tasks
❌ Bad: "do something on Facebook"
✅ Good: "post a photo on Facebook"

### 2. Review Before Executing
- Always check generated steps
- Verify button/field names match the actual website
- Add fallbacks for known UI variations

### 3. Break Down Complex Tasks
Instead of: "book flight, hotel, and car"
Do three separate tasks:
1. "book a flight to NYC"
2. "book hotel in NYC"
3. "rent a car in NYC"

### 4. Use Specific Field Names
❌ Bad: "fill input"
✅ Good: "fill email field with test@test.com"

### 5. Test on Simple Tasks First
Start with:
- "search Google for cats"
- "click Login button"
- "fill email field"

Then progress to complex workflows.

## Limitations

- ❌ Cannot handle CAPTCHAs
- ❌ Cannot authenticate (login) automatically for security
- ❌ Limited to single-page workflows (doesn't wait for navigation)
- ❌ May not work on heavily dynamic websites (React/Angular SPAs)
- ⚠️ Success depends on AI understanding of your task

## Future Enhancements

- [ ] Wait for page navigation between steps
- [ ] Conditional logic (if X exists, do Y)
- [ ] Loop support (repeat step N times)
- [ ] Variable support (save/reuse values)
- [ ] Multi-tab workflows
- [ ] Screenshot verification
- [ ] Natural language error recovery

---

## Quick Reference

| Action | Format | Example |
|--------|--------|---------|
| Search | `["search", "query"]` | `["search", "instagram"]` |
| Click | `["click", "text"]` | `["click", "Submit"]` |
| Fill | `["fill", "field\|value"]` | `["fill", "email\|test@test.com"]` |

**Enjoy automating complex tasks with AI!** 🚀
