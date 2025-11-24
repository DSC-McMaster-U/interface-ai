# AI-Powered Failure Recovery Guide 🤖

## Overview

When a step fails (all alternatives exhausted), the extension can use AI to analyze the current page and generate a **smart replacement step** based on what's actually available.

## How It Works

### 1. **Step Failure Detection**
When all alternatives for a step fail, you'll see:
```
❌ Step 9 FAILED (all 3 alts tried)
```

### 2. **User Prompt**
A dialog appears:
```
Step 9 failed.

Do you want me to analyze the page and generate a 
new replacement step based on what's actually available?

This will insert Step 9A with better alternatives.

[Cancel] [OK]
```

### 3. **AI Analysis Process**

**If you click OK:**

#### Step 3a: Scrape Page
- Extracts all visible buttons (up to 20)
- Extracts all text input fields (up to 20)
- Extracts all clickable links (up to 20)

**Example scraped data:**
```javascript
{
  buttons: ["Create", "New Post", "Upload", "Share", "Post"],
  textboxes: ["caption", "description", "title", "Write something"],
  links: ["Help", "Settings", "Profile"]
}
```

#### Step 3b: Send to AI
Backend receives:
- **Goal:** What the step was trying to do (e.g., "click: Create")
- **Failed attempts:** All alternatives that were tried
- **Available elements:** What's actually on the page

#### Step 3c: AI Generates Replacement
LLM analyzes:
- ❌ What didn't work
- ✅ What's available
- 🎯 Best alternatives to try

**Example AI response:**
```json
[
  ["click", "New Post"],
  ["click", "Upload"],
  ["click", "Create"]
]
```

#### Step 3d: Insert Step 9A
- New step inserted right after Step 9
- Marked with 🤖 (AI Fix) label
- Purple border for visibility
- Automatically positioned as "next"

### 4. **Continue Execution**
Click **Next** to try Step 9A with the AI-generated alternatives!

## Example Workflow

### Original Steps:
```
Step 8: [search, "instagram"]         ✅ Success
Step 9: [click, "Create"]              ❌ All 3 alts failed
  Alt 1: click "Create"                ❌ Failed
  Alt 2: click "New"                   ❌ Failed  
  Alt 3: click "+"                     ❌ Failed
```

### After AI Recovery:
```
Step 8: [search, "instagram"]         ✅ Success
Step 9: [click, "Create"]              ❌ Failed
Step 10 🤖 (AI Fix): [...]             ← NEW! Inserted here
  Alt 1: click "New Post"              ← From actual page
  Alt 2: click "Upload Photo"          ← From actual page
  Alt 3: click "Share"                 ← From actual page
Step 11: [click, "Next"]               ← Original Step 10
```

## Visual Indicators

### Normal Step
```
┌─────────────────────────────────────┐
│ Step 9                     [Delete] │
│ click: [Create        ]             │
│ click: [New           ] (fallback)  │
└─────────────────────────────────────┘
```

### AI-Generated Replacement Step
```
┌─────────────────────────────────────┐
│ Step 10 🤖 (AI Fix)        [Delete] │  ← Purple border
│ click: [New Post      ]             │    Purple background
│ click: [Upload Photo  ] (fallback)  │
│ click: [Share         ] (fallback)  │
└─────────────────────────────────────┘
```

## Benefits

✅ **Context-aware** - Uses what's actually on the page  
✅ **No manual editing** - AI does the work  
✅ **Learns from failures** - Knows what didn't work  
✅ **Smart alternatives** - Better than blind guessing  
✅ **Keeps going** - Don't stop at first failure  

## When to Use

### Good Use Cases
- ✅ Button text is different than expected
- ✅ Website UI changed recently
- ✅ Multiple similar buttons exist
- ✅ Field names are unclear

### Not Helpful When
- ❌ Element doesn't exist at all
- ❌ Page hasn't loaded yet
- ❌ Login/auth required
- ❌ CAPTCHA present

## Options When Step Fails

You have 2 choices:

### Option 1: Generate AI Replacement
- Click **OK** on prompt
- AI analyzes page
- Inserts Step XA with smart alternatives
- Continue with Next

### Option 2: Skip Step
- Click **Cancel** on prompt
- Skips to next step
- Faster if you know step isn't needed

## Backend API

### Endpoint: `/api/generate-replacement-step`

**Request:**
```json
{
  "goal": "click: Create",
  "triedAlternatives": [
    ["click", "Create"],
    ["click", "New"],
    ["click", "+"]
  ],
  "pageElements": {
    "buttons": ["New Post", "Upload", "Share", "Settings"],
    "textboxes": ["Caption", "Description"],
    "links": ["Help", "About"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "step": [
    ["click", "New Post"],
    ["click", "Upload"],
    ["click", "Share"]
  ],
  "goal": "click: Create"
}
```

## Technical Details

### Page Scraping
- **Location:** `content.js` - `scrapePageElements()`
- **Selectors:** 
  - Buttons: `button, input[type="button"], input[type="submit"], a, [role="button"], [onclick]`
  - Text fields: `input[type="text"], input[type="email"], textarea`
- **Limit:** 20 elements per category

### AI Prompt
- **Model:** `gemini-2.5-flash`
- **Context:** Goal, failed attempts, available elements
- **Output:** 2D array with 2-3 alternatives
- **Constraint:** Must use only elements from scraped list

### Storage
- Replacement steps saved to `chrome.storage.local`
- Marked with `isReplacement: true` flag
- Persist across popup closes

## Troubleshooting

### "Failed to scrape page elements"
- **Cause:** Content script not loaded
- **Fix:** Refresh the page and reload extension

### "Failed to generate replacement"
- **Cause:** Backend error or API issue
- **Fix:** Check backend logs, verify API key

### AI suggests wrong elements
- **Cause:** Page structure complex
- **Fix:** Manually edit the replacement step parameters

### Replacement step still fails
- **Try again:** Generate another replacement
- **Or skip:** Click Cancel and move to next step

## Tips for Best Results

1. **Let it scrape first** - AI needs to see what's available
2. **Try it once** - Give the AI replacement a chance
3. **Edit if needed** - Can manually tweak alternatives
4. **Multiple tries OK** - Can generate multiple replacements
5. **Skip if stuck** - Don't waste time on impossible steps

## Example Success Story

**Task:** "Post on Instagram"

**Problem:** Step 5 tried to click "Create" but Instagram changed UI

**Solution:**
1. Step 5 fails all alternatives
2. Click OK on AI prompt
3. AI scrapes page → finds "New Post", "Upload", "Share"
4. Generates Step 5A with these options
5. Step 5A succeeds with "New Post" ✅
6. Automation continues!

---

**Result:** From failure to success in seconds! 🚀
