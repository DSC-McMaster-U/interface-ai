# InterfaceAI Chrome Extension Setup

## Overview

This Chrome extension allows you to click buttons on any webpage by typing the button text. The flow is:

1. **User** types button text in extension popup (e.g., "Submit")
2. **Extension** sends text to Flask backend at `http://localhost:5000`
3. **Backend** processes the request and validates it
4. **Extension content script** clicks the button on the user's actual webpage

## Setup Instructions

### 1. Start the Backend Server

```bash
cd backend
python app/main.py
```

The Flask server will run on `http://localhost:5000`

### 2. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `frontend` folder from this project
5. The extension icon should appear in your Chrome toolbar

### 3. Test the Extension

1. Navigate to any webpage with buttons (e.g., a form with a Submit button)
2. Click the InterfaceAI extension icon in your Chrome toolbar
3. Type the button text (e.g., "Submit", "Login", "Next")
4. Click "Click Button"
5. The button on the webpage should be clicked!

## Architecture

```
┌─────────────┐
│   Chrome    │
│  Extension  │
│   Popup     │──(1)─┐
└─────────────┘      │
                     │ buttonText
                     ↓
              ┌─────────────┐
              │   Flask     │
              │   Backend   │
              │  (port 5000)│
              └─────────────┘
                     │
                     │ validation/processing
                     ↓
              ┌─────────────┐
              │ Background  │
              │   Script    │
              └─────────────┘
                     │
                     ↓
              ┌─────────────┐
              │  Content    │
              │   Script    │──(2)──> Click button on page
              └─────────────┘
```

## Files

- **`popup.html`** - Extension popup UI
- **`popup.js`** - Handles user input and communicates with backend
- **`background.js`** - Service worker that relays messages between popup and content script
- **`content.js`** - Runs on web pages and performs the actual button clicks
- **`manifest.json`** - Extension configuration

## Features

- ✅ Click buttons by text (case-insensitive)
- ✅ Supports multiple button types: `<button>`, `<input type="submit">`, `<a role="button">`, etc.
- ✅ Visual feedback: Highlights button briefly before clicking
- ✅ Backend validation and logging
- ✅ Error handling and user feedback

## Troubleshooting

### Backend not responding
- Make sure Flask server is running: `python backend/app/main.py`
- Check console for errors: Right-click extension icon → "Inspect popup"

### Button not found
- Check browser console (F12) for detailed error messages
- The content script looks for visible buttons containing the text (case-insensitive)
- Try being more specific with the button text

### Extension not working on a page
- Some pages (like `chrome://` URLs) don't allow content scripts
- Try refreshing the page after installing/updating the extension
- Check that content script loaded: Open DevTools → Console → Look for "[InterfaceAI] Content script loaded"

## Development

To see logs:
- **Popup logs**: Right-click extension icon → Inspect popup → Console
- **Background script logs**: Go to `chrome://extensions/` → Click "service worker" link → Console
- **Content script logs**: Open page DevTools (F12) → Console
- **Backend logs**: Check terminal where Flask is running
