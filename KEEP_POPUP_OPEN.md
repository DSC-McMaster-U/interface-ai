# How to Keep Extension Popup Open

## Problem
Chrome extension popups automatically close when you click anywhere outside them.

## Solution: Pin the Popup 📌

### Step 1: Open the Extension Popup
Click the InterfaceAI extension icon in your Chrome toolbar.

### Step 2: Find the Pin Icon
Look at the **top-right corner** of the popup window. You'll see:
```
┌─────────────────────────────────────┐
│ InterfaceAI              [📌]  [×] │  ← Pin icon here!
├─────────────────────────────────────┤
│ 💡 Keep popup open: Click the...   │
│                                     │
│ Input field...                      │
└─────────────────────────────────────┘
```

The pin icon (📌) appears next to the extension name, just before the close button (×).

### Step 3: Click the Pin Icon
- **Before pinning**: The icon looks like an unpinned thumbtack
- **After pinning**: The icon changes to show it's pinned
- The popup will now **stay open** even when you click on the webpage!

## Visual Location

```
Browser Toolbar
┌──────────────────────────────────────────────────┐
│ [☰] google.com        [⭐] [👤] [InterfaceAI] │
└──────────────────────────────────────────────────┘
                                       ↑
                              Click extension icon

Extension Popup Opens
┌─────────────────────────────────────┐
│ InterfaceAI         👈 [📌]    [×] │  ← CLICK THIS PIN!
├─────────────────────────────────────┤
│ 💡 Keep popup open: Click the...   │
│                                     │
│ [Input field]                       │
│ [Click Button] [Fill Textbox]      │
│ [Search Google]                     │
│ [🤖 Full Auto (AI)]                 │
└─────────────────────────────────────┘
```

## Benefits of Pinning

✅ Popup stays open when you click the page  
✅ Can see execution progress in real-time  
✅ Can click "Next" repeatedly without reopening  
✅ Easier to debug failed steps  
✅ Better workflow for multi-step automation  

## Alternative: Use Keyboard Shortcut

You can also assign a keyboard shortcut to the extension:
1. Go to `chrome://extensions/shortcuts`
2. Find "InterfaceAI"
3. Set a shortcut (e.g., `Ctrl+Shift+I`)
4. Press shortcut to toggle popup quickly

---

**Note:** The pin only works while you're on the same tab. If you switch tabs, the popup may close depending on Chrome's behavior.
