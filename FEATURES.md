# InterfaceAI Features Guide

## 🎯 Three Powerful Actions

### 1. Click Button 🟢
**What it does:** Clicks any button on the current webpage

**How to use:**
1. Type the button text in the input box
2. Click "Click Button" (green)
3. Example: `Submit`, `Login`, `Next`, `Cancel`

**Features:**
- Case-insensitive matching
- Partial text matching
- Supports: `<button>`, `<input type="submit">`, links with `role="button"`
- Visual feedback (green border highlight)

---

### 2. Fill Textbox 🔵
**What it does:** Fills any input field or textarea on the current webpage

**How to use:**
1. Type: `field_name|text_to_fill`
2. Click "Fill Textbox" (blue)
3. Examples:
   - `email|test@test.com`
   - `username|john_doe`
   - `search|playwright automation`
   - `password|mySecurePass123`

**Features:**
- Finds fields by: name, placeholder, id, or label text
- Works with `<input>` and `<textarea>`
- Triggers proper input events (so forms recognize the input)
- Visual feedback (blue border highlight)

---

### 3. Search Google 🟠
**What it does:** Searches Google for your query and automatically clicks the first result

**How to use:**
1. Type your search query
2. Click "Search Google" (orange)
3. Example: `playwright automation tutorial`

**What happens:**
1. Navigates to Google with your search
2. Waits 3 seconds for page to load
3. Finds first non-ad result
4. Clicks it automatically
5. Visual feedback (orange border highlight)

**Features:**
- Skips ads automatically
- Skips Google/YouTube links
- Only clicks visible results
- Works with current Google layout

---

## 🚀 Quick Examples

### Example 1: Login Flow
```
1. Fill Textbox: email|user@example.com
2. Fill Textbox: password|mypassword
3. Click Button: Login
```

### Example 2: Search and Navigate
```
1. Search Google: best pizza near me
   (Automatically clicks first result)
```

### Example 3: Form Submission
```
1. Fill Textbox: name|John Doe
2. Fill Textbox: email|john@example.com
3. Fill Textbox: message|Hello, this is a test!
4. Click Button: Submit
```

---

## 💡 Tips

### Click Button Tips:
- You don't need exact text - "subm" matches "Submit"
- Case doesn't matter - "LOGIN" finds "login"
- Works with hidden buttons if they're clickable

### Fill Textbox Tips:
- Use part of the field name: `email` matches fields with "email" in name/placeholder
- Use label text: `Email Address` finds field with that label
- Format is always: `field|value` (separated by pipe `|`)

### Search Google Tips:
- Be specific for better first results
- The extension waits 3 seconds - don't close the popup immediately
- It automatically skips ads and sponsored results

---

## 🔧 Setup

1. **Install Extension:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `frontend` folder

2. **Refresh Your Webpage:**
   - After installing, refresh any open tabs
   - This loads the content script

3. **Start Using:**
   - Click the extension icon in toolbar
   - Enter command and click action button

---

## 🐛 Troubleshooting

### "Could not establish connection"
**Solution:** Refresh the webpage (F5) after installing/reloading the extension

### Button/Field Not Found
**Solutions:**
- Make sure the element is visible on the page
- Try partial text matching
- Check DevTools console (F12) for detailed logs

### Search Google Not Working
**Solutions:**
- Wait for the popup message to update
- Make sure you're not blocking Google
- Try a different search query

---

## 📊 How It Works

```
┌─────────────────┐
│  Your Webpage   │  ← Content script injects here
│  (Any site)     │
└─────────────────┘
        ↑
        │ Direct manipulation (no page reload!)
        │
┌─────────────────┐
│  Content Script │  ← Finds elements & performs actions
│  (content.js)   │
└─────────────────┘
        ↑
        │ Chrome message passing
        │
┌─────────────────┐
│  Extension UI   │  ← You interact here
│  (popup.html)   │
└─────────────────┘
```

**Key Benefits:**
✅ Works on your **actual Chrome tab**
✅ **No page reload** needed
✅ **Instant** actions
✅ **No separate browser** window
✅ **No backend** required

---

## 🎨 Visual Feedback

Each action highlights the target element:
- **Green border** = Button being clicked
- **Blue border** = Textbox being filled
- **Orange border** = Search result being clicked

Highlights last 0.5-1 second for visual confirmation.

---

## 🔮 Coming Soon

- Multiple actions in sequence
- Wait/delay between actions
- Save action sequences
- Record and replay workflows
- AI-powered element detection

---

**Enjoy automating your web interactions!** 🎉
