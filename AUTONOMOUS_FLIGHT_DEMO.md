# 🚀 Autonomous Flight Booking Demo

## Overview

InterfaceAI now features **Autonomous Mode** - an intelligent web navigation system that can:
- 🔍 **Autonomously search** for the best website to complete tasks
- 🌐 **Navigate dynamically** through flight booking sites
- 💰 **Extract and compare** flight options
- 🎯 **Present choices** for user confirmation before booking

This is similar to how OpenAI and Perplexity's web browsers work - the AI agent understands your intent, finds the right website, performs complex interactions, and brings back options for your approval.

## Architecture

### Core Components

1. **Web Navigator** (`web_navigator.py`)
   - Autonomously selects best website for task (Google Flights, Kayak, etc.)
   - Extracts flight parameters from natural language
   - Generates intelligent navigation plans

2. **Flight Orchestrator** (`flight_orchestrator.py`)
   - Coordinates the entire flight search process
   - Extracts and ranks flight options based on preferences
   - Manages user selection flow

3. **Page Executor** (`page_executor.py`)
   - Intelligently finds elements on dynamic pages
   - Vision-based page analysis using GPT-4 Vision
   - Creates robust execution scripts

4. **Autonomous Executor** (`autonomous_executor.js`)
   - Chrome extension content script
   - Executes navigation plans on real webpages
   - Extracts flight results and shows options to user

## How It Works

### Workflow

```
User Intent → Website Selection → Navigation Plan → Execution → Extract Results → Present Options → User Confirms
```

1. **User provides intent**: "book a flight from Toronto to NYC, find me the cheapest options"

2. **AI selects website**: Analyzes intent and chooses Google Flights (most reliable, no account needed)

3. **Extracts parameters**:
   ```json
   {
     "origin": "Toronto",
     "destination": "New York City",
     "preferences": ["cheapest"]
   }
   ```

4. **Generates navigation plan**:
   - Navigate to google.com/flights
   - Click origin input field
   - Type "Toronto"
   - Select first suggestion
   - (continues for destination, search, etc.)

5. **Executes autonomously**: Content script navigates the site, filling forms and clicking buttons

6. **Extracts results**: Scrapes flight cards with prices, times, airlines, stops

7. **Ranks options**: Sorts by price, duration, or other preferences

8. **Shows options**: Presents top 5 flights in a clean modal overlay

9. **User selects**: Click to choose a flight and proceed to booking

## Usage

### Setup

1. **Install dependencies**:
```bash
cd backend
pip install openai flask flask-cors
```

2. **Set API key**:
```bash
export OPENAI_API_KEY="your-key-here"
```

3. **Start backend**:
```bash
cd backend
python app/main.py
```

4. **Load extension in Chrome**:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `frontend` folder

### Demo Flight Booking

1. **Open a new tab** (any page will work)

2. **Click the InterfaceAI extension icon**

3. **Enter your intent**:
   ```
   book a flight from Toronto to NYC, show me the cheapest options
   ```

4. **Click "🚀 Autonomous Mode"**

5. **Watch the magic**:
   - Extension navigates to Google Flights
   - Fills in departure/destination
   - Searches for flights
   - Extracts all results
   - Shows you the best options

6. **Select your flight** from the presented options

## Example Queries

### Flight Searches
- "book a flight from Toronto to NYC"
- "find me a cheap flight to Los Angeles next week"
- "book a direct flight from San Francisco to Boston"
- "show me fastest flights from Chicago to Miami"

### With Preferences
- "book a flight from NYC to London, cheapest options"
- "find direct flights from LA to NYC departing tomorrow"
- "show me business class flights to Tokyo"

## Key Features

### 🧠 Intelligent Website Selection
The system automatically selects the best website for your task:
- **Flight bookings**: Google Flights > Kayak > Skyscanner
- Considers factors: reliability, no account requirement, data quality

### 🎯 Smart Element Finding
Uses multiple strategies to find elements:
- Placeholder text matching
- ARIA labels
- CSS selectors
- Visual analysis with GPT-4 Vision
- Fallback strategies

### 💎 Preference-Based Ranking
Flights are scored based on:
- **Price** (cheapest gets highest score)
- **Duration** (faster is better)
- **Stops** (direct flights preferred)
- Custom weighting algorithm

### 🔄 Robust Execution
- Multiple selector strategies per element
- Automatic retries with alternatives
- Graceful error handling
- Visual progress indicators

## API Endpoints

### POST `/api/flight/search`
Start autonomous flight search
```json
{
  "intent": "book a flight from Toronto to NYC",
  "session_id": "session_123"
}
```

### POST `/api/flight/extract`
Extract flight options from page
```json
{
  "page_content": "...",
  "session_id": "session_123"
}
```

### POST `/api/flight/options`
Get ranked flight options
```json
{
  "session_id": "session_123",
  "count": 5
}
```

### POST `/api/flight/select`
User selects a flight
```json
{
  "session_id": "session_123",
  "flight_id": "flight_1"
}
```

### POST `/api/page/analyze`
Analyze page screenshot with vision
```json
{
  "screenshot": "base64_image",
  "context": "looking for flight search form"
}
```

## Technical Details

### Vision-Based Analysis
Uses GPT-4 Vision (`gpt-4o`) to:
- Identify page type (search form, results, booking page)
- Find interactive elements
- Determine page state (loaded, loading)
- Extract visible data
- Suggest next actions

### Element Finding Strategies
1. **Direct selectors**: `input[placeholder*='From']`
2. **ARIA labels**: `input[aria-label*='departure']`
3. **Data attributes**: `[data-testid*='origin']`
4. **Text matching**: Find buttons by text content
5. **Visual analysis**: Use screenshot to locate elements

### Wait Strategies
- **Page load**: `document.readyState === 'complete'`
- **Network idle**: Wait for AJAX requests
- **Suggestions**: Wait for dropdown/autocomplete
- **Content stable**: Wait for dynamic content to stop changing

## Extending the System

### Add New Task Types

1. **Create orchestrator** (like `flight_orchestrator.py`):
```python
class HotelOrchestrator:
    def process_hotel_request(self, intent):
        # Similar to flight booking
        pass
```

2. **Add to web_navigator.py**:
```python
if "hotel" in intent_lower:
    return {"recommended_site": {...}}
```

3. **Create extraction logic**:
```python
def extract_hotel_options(page_content):
    # Parse hotel listings
    pass
```

### Add New Websites

Update `_generate_plan_fallback` in `web_navigator.py`:
```python
if "kayak.com" in url:
    steps = [
        # Kayak-specific navigation steps
    ]
```

## Troubleshooting

### Backend not connecting
- Check Flask is running on port 5001
- Verify `OPENAI_API_KEY` is set
- Check CORS settings

### Elements not found
- Website structure may have changed
- Add new selectors to `_find_element_fallback`
- Use visual analysis for complex cases

### No flights extracted
- Check selectors in `extractFlightResults`
- Verify page fully loaded before extraction
- Add more selector strategies

## Future Enhancements

- [ ] Screenshot-based verification
- [ ] Multi-site comparison (search across Google Flights + Kayak)
- [ ] Date flexibility (search multiple dates)
- [ ] Price tracking and alerts
- [ ] Complete booking flow (beyond search)
- [ ] Support for hotels, restaurants, services
- [ ] Conversation memory across sessions
- [ ] Error recovery and self-healing

## Demo Video Script

1. Show Chrome extension popup
2. Enter: "book a flight from Toronto to NYC"
3. Click Autonomous Mode button
4. Watch progress indicator on page
5. Google Flights opens automatically
6. Fields get filled in real-time
7. Search executes automatically
8. Modal appears with top 5 options
9. Shows prices, times, airlines
10. Click to select preferred flight

---

**This is the next generation of AI agents - autonomous, intelligent, and user-friendly.** 🚀
