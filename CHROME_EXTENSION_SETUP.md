# 🎯 Chrome Extension Setup Guide

## Quick Setup (3 Steps)

### Step 1: Start the Backend Server

Open a terminal and run:

```bash
cd /Users/anhadchawla/Documents/GitHub/interface-ai/backend
./start_backend.sh
```

You should see:
```
🚀 Starting InterfaceAI Backend...
📍 API will be available at: http://localhost:5000
🔑 Using OpenAI API for Step Creator
```

**Keep this terminal open!** The server needs to run while you use the extension.

---

### Step 2: Load Extension in Chrome

1. **Open Chrome** and go to: `chrome://extensions/`

2. **Enable Developer Mode** (toggle in the top-right corner)

3. **Click "Load unpacked"**

4. **Navigate to and select this folder:**
   ```
   /Users/anhadchawla/Documents/GitHub/interface-ai/frontend
   ```

5. **You should see "InterfaceAI MVP" appear** in your extensions list

---

### Step 3: Test the Extension

1. **Click the extension icon** in your Chrome toolbar (puzzle piece icon → InterfaceAI)

2. **You should see:**
   - 🤖 InterfaceAI popup
   - Status showing "✓ Connected to backend"

3. **Try an example intent:**
   ```
   book a flight from Toronto to New York
   ```

4. **Click "Generate Steps"** and watch the magic happen! ✨

---

## 🎮 Example Intents to Try

Once loaded, try these in the extension:

- `message my first instagram DM hello`
- `book a flight from Toronto to Paris`
- `order a large pepperoni pizza from Dominos`
- `open YouTube and search for calculus lecture`
- `create a new AWS EC2 instance`
- `find restaurants near me on Google Maps`

---

## 🎨 What You'll See

The extension will:
1. Take your intent
2. Send it to the backend
3. Use OpenAI to generate smart automation steps
4. Display each step with icons and descriptions

Example output:
```
Step 1 🌐
NAVIGATE: flight booking website
Navigate to Google Flights

Step 2 👆
CLICK: departure input
Click on the departure city input field

Step 3 ⌨️
TYPE: departure input
Value: "Toronto"
Type 'Toronto' in departure field
...
```

---

## 🔧 Troubleshooting

### "Backend offline" error
**Solution:** Make sure the Flask server is running
```bash
cd /Users/anhadchawla/Documents/GitHub/interface-ai/backend
./start_backend.sh
```

### Extension not showing up in Chrome
**Solution:** 
1. Make sure Developer Mode is ON in `chrome://extensions/`
2. Click "Load unpacked" again
3. Select the `/frontend` folder

### "Failed to generate steps" error
**Solution:** 
- Check the terminal where Flask is running for error messages
- Make sure the OpenAI API key is valid
- Try restarting the Flask server

### Steps seem generic
**Good news:** With your OpenAI API key, you're getting the best results! The fallback mode (without API key) is more limited.

---

## 📂 Project Structure

```
interface-ai/
├── backend/
│   ├── start_backend.sh          ← Run this to start server
│   └── app/
│       ├── main.py                ← Flask API
│       ├── step_creator.py        ← AI logic
│       └── demo_step_creator.py   ← Standalone testing
│
└── frontend/
    ├── manifest.json              ← Chrome extension config
    ├── popup.html                 ← Extension UI
    └── popup.js                   ← Extension logic
```

---

## 🚀 Next Steps

After testing the extension:

1. **Try different intents** to see what the AI generates
2. **Experiment with complex tasks** to push the boundaries
3. **Check the Flask terminal** to see API calls in real-time
4. **Next feature:** Connect to Playwright to actually execute these steps!

---

## 🛑 Stopping Everything

When you're done:

1. **Stop the Flask server:** Press `Ctrl+C` in the terminal
2. **Disable the extension:** Go to `chrome://extensions/` and toggle it off

---

## 💡 Pro Tips

- **Keep the Flask terminal visible** to see what's happening
- **Press Enter** in the text box to quickly generate steps
- **The extension remembers** your backend connection status
- **Try edge cases** like "book a flight to Mars" to see how the AI handles it

---

## 📞 Need Help?

If something's not working:
1. Check the Flask terminal for errors
2. Check Chrome DevTools console (right-click extension → Inspect)
3. Make sure port 5000 is not being used by another app

---

**Ready to go? Start with Step 1 above! 🚀**
