# 🧪 Testing Autonomous Flight Booking Mode

## Quick Start (5 minutes)

### 1. Set Up Backend

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."

# Start the autonomous backend
cd backend
./start_autonomous.sh
```

You should see:
```
✓ OPENAI_API_KEY detected
✓ All dependencies installed
🔥 Starting Flask backend on port 5001...
```

### 2. Load Chrome Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Toggle **"Developer mode"** (top right)
4. Click **"Load unpacked"**
5. Select the `frontend/` folder
6. Pin the extension to your toolbar

### 3. Test the Demo

#### Option A: Simple Test (Step-by-Step mode)
1. Open a new Chrome tab
2. Click the InterfaceAI extension icon
3. Type: `book a flight from Toronto to NYC`
4. Click **"Generate Steps"** to see the plan
5. Click **"Execute These Steps"** to run it

#### Option B: Autonomous Mode (Full Auto) 🚀
1. Open a new Chrome tab
2. Click the InterfaceAI extension icon
3. Type: `book a flight from Toronto to NYC, show me the cheapest options`
4. Click **"🚀 Autonomous Mode"**
5. **Watch the magic happen**:
   - Browser navigates to Google Flights automatically
   - Origin field gets filled with "Toronto"
   - Destination field gets filled with "NYC"
   - Search button clicked automatically
   - Flight results extracted
   - Top options shown in a beautiful modal

6. **Select a flight** from the options presented

## Test Cases

### Test Case 1: Basic Flight Search
```
Intent: book a flight from Toronto to NYC
Expected: Navigates to Google Flights, fills in fields, searches, shows results
```

### Test Case 2: With Preference
```
Intent: find me the cheapest flight from San Francisco to Boston
Expected: Same as above, but results sorted by price
```

### Test Case 3: Direct Flights Only
```
Intent: book a direct flight from LA to Miami
Expected: Preference for non-stop flights in ranking
```

### Test Case 4: Multiple Cities
```
Intent: book a flight from Chicago to London
Expected: International search with proper currency handling
```

## What to Watch For

### ✅ Success Indicators
- Progress indicator appears in top-right of page
- Page navigates to google.com/flights automatically
- Form fields fill in character-by-character
- Search executes without manual intervention
- Modal appears with flight options
- Options show prices, times, airlines
- Can click to select a flight

### ❌ Common Issues

**"Backend offline"**
- Solution: Make sure Flask is running on port 5001
- Check: `curl http://localhost:5001/health`

**"Element not found"**
- Cause: Website structure changed or page not fully loaded
- Solution: Increase wait times in steps, update selectors

**"No flights extracted"**
- Cause: Results page format changed
- Solution: Check browser console for errors, update selectors in `autonomous_executor.js`

**"CORS error"**
- Cause: Backend CORS not configured correctly
- Solution: Check `main.py` has proper CORS origins

## Debugging

### Check Backend Logs
```bash
# Backend terminal shows:
# - Request received
# - Website selected
# - Parameters extracted
# - Steps generated
```

### Check Browser Console
```bash
# Right-click → Inspect → Console
# Look for:
# - "Starting autonomous flow for: ..."
# - "Executing step X/Y: ..."
# - "Found X flight cards with selector: ..."
```

### Test Individual APIs

**Test website selection:**
```bash
curl -X POST http://localhost:5001/api/flight/search \
  -H "Content-Type: application/json" \
  -d '{"intent": "book a flight from Toronto to NYC"}'
```

**Test page analysis (with screenshot):**
```bash
curl -X POST http://localhost:5001/api/page/analyze \
  -H "Content-Type: application/json" \
  -d '{"screenshot": "base64_string", "context": "flight search"}'
```

## Performance Expectations

- **Website Selection**: < 1 second
- **Parameter Extraction**: < 1 second
- **Navigation Plan Generation**: 1-2 seconds
- **Page Navigation**: 2-5 seconds
- **Form Filling**: 3-5 seconds per field
- **Search Execution**: 2-3 seconds
- **Results Extraction**: 2-5 seconds
- **Total Time**: ~15-30 seconds end-to-end

## Advanced Testing

### Test with Different Websites

Edit `web_navigator.py` to prefer different sites:
```python
if "flight" in intent_lower:
    return {
        "recommended_site": {
            "name": "Kayak",
            "url": "kayak.com",
            ...
        }
    }
```

### Test Vision Analysis

The system can use GPT-4 Vision to analyze screenshots:
```javascript
// In browser console
chrome.runtime.sendMessage({
  action: "takeScreenshot",
  context: "looking for search form"
});
```

### Test Manual Extraction

Run extraction on current page:
```javascript
// In browser console on a flight results page
chrome.runtime.sendMessage(
  { action: "extractFlights" },
  (response) => console.log(response.flights)
);
```

## Example Success Flow

```
1. User opens extension
2. Types "book a flight from Toronto to NYC"
3. Clicks "🚀 Autonomous Mode"
4. Extension calls /api/flight/search
5. Backend returns navigation plan
6. Content script executes each step:
   - Navigate to google.com/flights ✓
   - Wait for page load ✓
   - Click origin field ✓
   - Type "Toronto" ✓
   - Wait for suggestions ✓
   - Click first suggestion ✓
   - Click destination field ✓
   - Type "NYC" ✓
   - Wait for suggestions ✓
   - Click first suggestion ✓
   - Click search button ✓
   - Wait for results ✓
   - Extract flight cards ✓
7. Backend ranks flights
8. Modal shows top 5 options
9. User clicks preferred flight
10. Backend records selection
```

## Troubleshooting Commands

```bash
# Check if backend is running
curl http://localhost:5001/health

# Test step generation (old API)
curl -X POST http://localhost:5001/api/create-steps \
  -H "Content-Type: application/json" \
  -d '{"intent": "book a flight from Toronto to NYC"}'

# Test autonomous search (new API)
curl -X POST http://localhost:5001/api/flight/search \
  -H "Content-Type: application/json" \
  -d '{"intent": "book a flight from Toronto to NYC", "session_id": "test123"}'

# Check extension is loaded
# Go to chrome://extensions/ and verify InterfaceAI is enabled

# Check content script loaded
# Open any webpage, right-click → Inspect → Console
# Should see: "InterfaceAI Autonomous Executor loaded"
```

## Next Steps After Testing

1. **Add more websites**: Extend `web_navigator.py` with Kayak, Skyscanner selectors
2. **Add vision analysis**: Implement screenshot capture in background.js
3. **Add date pickers**: Handle calendar date selection
4. **Add filtering**: Let users filter by airline, time, etc.
5. **Add booking completion**: Continue beyond search to actual booking

## Support

If you encounter issues:
1. Check backend logs for errors
2. Check browser console for JavaScript errors
3. Verify OPENAI_API_KEY is valid
4. Try with a different intent/website
5. Check the AUTONOMOUS_FLIGHT_DEMO.md for more details

---

**Happy Testing! 🚀** This is cutting-edge AI agent technology in action.
