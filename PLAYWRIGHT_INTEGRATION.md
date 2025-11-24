# InterfaceAI: Playwright ActionExecutor Integration

## 🎯 Overview

The system now uses **Playwright** via the `ActionExecutor` class to click buttons. When you type button text in the Chrome extension, it:

1. Gets the current tab's URL
2. Sends button text + URL to Flask backend
3. Backend uses `action_executor.py` to open a **new Playwright browser**
4. Playwright navigates to the URL and clicks the button
5. Backend reports if button was **FOUND** or **NOT FOUND** ✅❌

## 🔄 Architecture Flow

```
┌─────────────────┐
│  Chrome Tab     │
│  (user's page)  │
└─────────────────┘
         │
         │ (1) Get current URL
         ↓
┌─────────────────┐
│  Extension      │
│  Popup          │
└─────────────────┘
         │
         │ (2) POST /api/click-button
         │     { buttonText, url }
         ↓
┌─────────────────┐
│  Flask Backend  │
│  (port 5000)    │
└─────────────────┘
         │
         │ (3) Import ActionExecutor
         ↓
┌─────────────────┐
│  action_        │
│  executor.py    │
└─────────────────┘
         │
         │ (4) Launch Playwright
         ↓
┌─────────────────┐
│  NEW Playwright │
│  Browser Window │ ← Opens separately!
│  - Navigate URL │
│  - Click button │
└─────────────────┘
         │
         │ (5) Return status
         │     { found: true/false }
         ↓
┌─────────────────┐
│  Backend prints │
│  ✅ FOUND       │
│  ❌ NOT FOUND   │
└─────────────────┘
```

## 📋 Key Changes

### Backend (`backend/app/main.py`)

**What changed:**
- ✅ Imports `ActionExecutor` from `action_executor.py`
- ✅ Creates Playwright browser instance (non-headless by default)
- ✅ Navigates to the URL from the extension
- ✅ Calls `executor.click_button_by_text(button_text)`
- ✅ **Prints status**: `✅ Button FOUND` or `❌ Button NOT FOUND`
- ✅ Returns `found: true/false` in response
- ✅ Properly cleans up browser after operation

**Backend Console Output:**
```
[Backend] 🎯 Received button click request
[Backend]    Button text: 'Submit'
[Backend]    URL: https://example.com
[Backend] 🚀 Starting Playwright browser...
[Backend] 📄 Navigated to page: Example Page
[Backend] 🔍 Searching for button: 'Submit'
[Backend] ✅ Button FOUND and clicked: 'Submit'
[Backend] 📤 Sending response: {...}
[Backend] 🧹 Closing Playwright browser...
```

### Frontend (`popup.js`)

**What changed:**
- ✅ Gets current tab URL using `chrome.tabs.query()`
- ✅ Sends both `buttonText` and `url` to backend
- ✅ Displays clear status: `✅ Button FOUND` or `❌ Button NOT FOUND`
- ✅ Shows page title in the result

### Requirements

**Added to `playwright/requirements.txt`:**
```
playwright==1.40.0
```

## 🚀 Setup Instructions

### 1. Install Playwright

```bash
cd playwright
pip install -r requirements.txt
playwright install chromium
```

The `playwright install chromium` command downloads the browser binaries.

### 2. Start Backend

```bash
cd backend
python app/main.py
```

You should see:
```
[Backend] ActionExecutor imported successfully
 * Running on http://0.0.0.0:5000
```

### 3. Load Chrome Extension

1. Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. "Load unpacked" → Select `frontend` folder

### 4. Test It

1. Go to any webpage (e.g., `frontend/test-page.html`)
2. Click the InterfaceAI extension icon
3. Type a button name: "Submit"
4. Click "Click Button via Playwright"
5. **Watch**: A new Playwright browser window opens
6. **Watch**: It navigates to the URL and clicks the button
7. **Check backend console**: See `✅ Button FOUND` or `❌ Button NOT FOUND`

## 📊 Status Reporting

### Backend Prints

**Button Found:**
```
[Backend] ✅ Button FOUND and clicked: 'Submit'
```

**Button NOT Found:**
```
[Backend] ❌ Button NOT FOUND: 'Submit'
```

### Extension Shows

**Button Found:**
```
✅ Button FOUND and clicked: "Submit"
Page: Example Page
```

**Button NOT Found:**
```
❌ Button NOT FOUND: "Submit"
Page: Example Page
```

### API Response

**Success (Button Found):**
```json
{
  "success": true,
  "message": "Button 'Submit' clicked successfully",
  "buttonText": "Submit",
  "found": true,
  "url": "https://example.com",
  "pageTitle": "Example Page"
}
```

**Failure (Button NOT Found):**
```json
{
  "success": false,
  "message": "Button 'Submit' not found on page",
  "buttonText": "Submit",
  "found": false,
  "url": "https://example.com",
  "pageTitle": "Example Page"
}
```

## 🔍 How ActionExecutor Finds Buttons

The `action_executor.py` `click_button_by_text()` method tries multiple selectors:

1. `button:has-text('Submit')`
2. `input[type='submit']:has-text('Submit')`
3. `input[type='button']:has-text('Submit')`
4. `a:has-text('Submit')`
5. `[role='button']:has-text('Submit')`
6. Case-insensitive regex versions

See `action_executor.py` lines 93-153 for full implementation.

## 💡 Important Notes

### Playwright Opens a NEW Browser Window

- Playwright does NOT control your Chrome browser
- It opens a **separate browser window** (Chromium)
- This is by design - Playwright automation works independently
- The extension just provides the URL to replicate

### Headless Mode

By default, the browser is **visible** (`headless=False`) so you can see what's happening.

To run in headless mode (no window), change in `main.py` line 97:
```python
executor = ActionExecutor(headless=True)
```

### Browser Cleanup

The backend properly closes the Playwright browser after each operation using a `finally` block.

## 🐛 Troubleshooting

### "Playwright ActionExecutor not available"

**Cause:** Playwright not installed

**Fix:**
```bash
cd playwright
pip install playwright
playwright install chromium
```

### "ModuleNotFoundError: No module named 'action_executor'"

**Cause:** Python can't find the module

**Fix:** Backend already has this line:
```python
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "playwright"))
```

Verify the path is correct relative to `backend/app/main.py`.

### Backend prints nothing

**Cause:** Flask not running or wrong port

**Fix:** 
- Check Flask is running: `python backend/app/main.py`
- Verify it's on port 5000
- Check extension API URL matches: `http://localhost:5000`

### Button not found but it exists

**Cause:** Button text doesn't match exactly, or button isn't visible

**Fix:**
- Check exact button text (case doesn't matter)
- Try partial text: "Submi" might match "Submit"
- Check if button is visible when page loads
- Look at backend logs for which selectors were tried

## 📝 Files Modified

1. **`backend/app/main.py`** - Now uses ActionExecutor
2. **`frontend/popup.js`** - Sends URL to backend
3. **`frontend/popup.html`** - Updated UI text
4. **`playwright/requirements.txt`** - Added playwright dependency

## 🎉 Benefits of This Approach

✅ **Uses existing action_executor.py** - No duplicate code
✅ **Clear status reporting** - Know if button was found
✅ **Backend logging** - See everything in terminal
✅ **Robust button finding** - Multiple selector strategies
✅ **Clean architecture** - Extension → Backend → Playwright
✅ **Easy to debug** - Visual browser window + console logs

## 🔮 Future Enhancements

- Add button listing endpoint (show all buttons on page)
- Support for filling forms before clicking
- Action sequences (fill field → click button)
- Screenshot capture before/after
- Headless mode toggle from extension
- Action history and replay
