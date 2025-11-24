"""
Web Navigator - Autonomous web search and navigation system
Intelligently searches for and selects the best websites to perform tasks
"""
import os
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime


def _create_gemini_model(api_key: str = None):
    """Create and configure a Google Gemini model for web navigation tasks."""
    try:
        import google.generativeai as genai
    except ImportError:
        print("Google Generative AI library not installed. Run: pip install google-generativeai")
        return None

    api_key = api_key or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in environment")
        return None

    genai.configure(api_key=api_key)

    generation_config = {
        "temperature": 0.2,
        "top_p": 1,
        "top_k": 1,
        "max_output_tokens": 2000,
    }

    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]

    return genai.GenerativeModel(
        model_name="gemini-1.5-flash-latest",
        generation_config=generation_config,
        safety_settings=safety_settings,
    )


def search_for_best_website(task_intent: str, api_key: str = None) -> Dict:
    """
    Autonomously searches Google and selects the best website for a task.
    
    Args:
        task_intent: The user's high-level intent (e.g., "book a flight to NYC")
        api_key: Gemini API key for intelligent analysis (defaults to GOOGLE_API_KEY)
    
    Returns:
        Dictionary with:
        - search_query: The query to use
        - recommended_site: Best site to use
        - alternatives: List of alternative sites
        - reasoning: Why this site was chosen
    """
    model = _create_gemini_model(api_key)
    if not model:
        return _get_fallback_website(task_intent)
    
    system_prompt = """You are a web navigation expert. Given a user's task intent, determine:
1. What search query would find the best websites to accomplish this task
2. Which specific website is BEST for this task (prefer sites that are reliable, user-friendly, and don't require accounts)
3. Alternative websites that could work
4. Why this site is the best choice

For flight bookings, prefer: Google Flights (google.com/flights), Kayak, Skyscanner - in that order.
For general tasks, use common, reliable websites.

Return ONLY valid JSON in this format:
{
  "search_query": "best flight booking site",
  "recommended_site": {
    "name": "Google Flights",
    "url": "google.com/flights",
    "reasoning": "No account needed, best UI, shows multiple airlines"
  },
  "alternatives": [
    {"name": "Kayak", "url": "kayak.com"},
    {"name": "Skyscanner", "url": "skyscanner.com"}
  ]
}"""
    
    try:
        prompt = f"{system_prompt}\n\nTask: {task_intent}"
        response = model.generate_content(prompt)

        if not getattr(response, "candidates", None):
            raise ValueError("No candidates returned from Gemini")

        candidate = response.candidates[0]
        finish_reason = getattr(candidate, "finish_reason", None)
        if finish_reason not in (None, 1):
            raise ValueError(f"Gemini did not finish normally (finish_reason={finish_reason})")

        try:
            content = candidate.content.parts[0].text.strip()
        except Exception:
            content = getattr(response, "text", "").strip()

        # Extract JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        result = json.loads(content)
        return result
        
    except Exception as e:
        print(f"Error in website search: {e}")
        return _get_fallback_website(task_intent)


def _get_fallback_website(task_intent: str) -> Dict:
    """Fallback website selection using pattern matching"""
    intent_lower = task_intent.lower()
    
    if "flight" in intent_lower or "fly" in intent_lower:
        return {
            "search_query": "flight booking",
            "recommended_site": {
                "name": "Google Flights",
                "url": "google.com/flights",
                "reasoning": "Most reliable and user-friendly flight search"
            },
            "alternatives": [
                {"name": "Kayak", "url": "kayak.com"},
                {"name": "Skyscanner", "url": "skyscanner.com"}
            ]
        }
    elif "hotel" in intent_lower:
        return {
            "search_query": "hotel booking",
            "recommended_site": {
                "name": "Booking.com",
                "url": "booking.com",
                "reasoning": "Comprehensive hotel search"
            },
            "alternatives": [
                {"name": "Hotels.com", "url": "hotels.com"}
            ]
        }
    else:
        # Generic Google search
        return {
            "search_query": task_intent,
            "recommended_site": {
                "name": "Google Search",
                "url": f"google.com/search?q={task_intent.replace(' ', '+')}",
                "reasoning": "General search for task"
            },
            "alternatives": []
        }


def extract_task_parameters(task_intent: str, task_type: str = "flight", api_key: str = None) -> Dict:
    """
    Extracts structured parameters from natural language task intent.
    
    Args:
        task_intent: User's natural language request
        task_type: Type of task (flight, hotel, etc.)
        api_key: API key for LLM (defaults to GOOGLE_API_KEY for Gemini)
    
    Returns:
        Dictionary with extracted parameters
    """
    model = _create_gemini_model(api_key)
    if not model:
        return _extract_parameters_fallback(task_intent, task_type)
    
    if task_type == "flight":
        system_prompt = """Extract flight booking parameters from natural language.
Return ONLY valid JSON with these fields:
{
  "origin": "departure city/airport",
  "destination": "arrival city/airport", 
  "departure_date": "YYYY-MM-DD or 'flexible'",
  "return_date": "YYYY-MM-DD or null for one-way",
  "passengers": number,
  "class": "economy/business/first",
  "preferences": ["cheapest", "fastest", "direct", etc.]
}

If information is missing, use reasonable defaults or null."""
    else:
        system_prompt = f"""Extract parameters for {task_type} task from natural language.
Return valid JSON with relevant fields."""
    
    try:
        response = model.generate_content(system_prompt + "\n\n" + task_intent)

        if not getattr(response, "candidates", None):
            raise ValueError("No candidates returned from Gemini")

        candidate = response.candidates[0]
        finish_reason = getattr(candidate, "finish_reason", None)
        if finish_reason not in (None, 1):
            raise ValueError(f"Gemini did not finish normally (finish_reason={finish_reason})")

        try:
            content = candidate.content.parts[0].text.strip()
        except Exception:
            content = getattr(response, "text", "").strip()

        # Extract JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        params = json.loads(content)
        return params
        
    except Exception as e:
        print(f"Error extracting parameters: {e}")
        return _extract_parameters_fallback(task_intent, task_type)


def _extract_parameters_fallback(task_intent: str, task_type: str) -> Dict:
    """Fallback parameter extraction using simple parsing"""
    import re
    
    intent_lower = task_intent.lower()
    
    if task_type == "flight":
        # Extract cities
        from_match = re.search(r'from\s+([a-z\s]+?)(?:\s+to|\s+departure|$)', intent_lower)
        to_match = re.search(r'to\s+([a-z\s]+?)(?:\s+on|\s+departure|$|\s+from)', intent_lower)
        
        # Extract dates
        date_patterns = [
            r'(\d{4}-\d{2}-\d{2})',
            r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}',
            r'(next|this)\s+(week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)'
        ]
        
        # Look for cheapest preference
        preferences = []
        if "cheap" in intent_lower or "budget" in intent_lower:
            preferences.append("cheapest")
        if "direct" in intent_lower or "nonstop" in intent_lower:
            preferences.append("direct")
        if "fast" in intent_lower or "quick" in intent_lower:
            preferences.append("fastest")
        
        return {
            "origin": from_match.group(1).strip() if from_match else None,
            "destination": to_match.group(1).strip() if to_match else None,
            "departure_date": "flexible",
            "return_date": None,
            "passengers": 1,
            "class": "economy",
            "preferences": preferences if preferences else ["cheapest"]
        }
    
    return {}


def generate_navigation_plan(task_intent: str, website: Dict, parameters: Dict, api_key: str = None) -> List[Dict]:
    """
    Generates a detailed navigation plan for a specific website.
    
    Args:
        task_intent: User's original intent
        website: Selected website info
        parameters: Extracted task parameters
        api_key: API key for LLM (defaults to GOOGLE_API_KEY for Gemini)
    
    Returns:
        List of detailed navigation steps
    """
    # For Google Flights we rely on a hand-crafted fallback plan which is often
    # more stable than generic LLM output.
    url = website.get("url", "")
    if "google.com/flights" in url:
        return _generate_plan_fallback(website, parameters)

    model = _create_gemini_model(api_key)
    if not model:
        return _generate_plan_fallback(website, parameters)
    
    system_prompt = f"""You are a web automation expert. Generate detailed navigation steps for {website['name']} at {website['url']}.

Each step should be specific and actionable. Return ONLY a JSON array with steps like:

[
  {{"action": "navigate", "target": "url", "value": "{website['url']}", "description": "Navigate to website", "wait_for": "page_load"}},
  {{"action": "wait", "target": "element", "value": "input[placeholder*='From']", "description": "Wait for search form"}},
  {{"action": "click", "target": "input[placeholder*='From']", "value": "", "description": "Click origin input"}},
  {{"action": "type", "target": "input[placeholder*='From']", "value": "Toronto", "description": "Enter origin city"}},
  {{"action": "wait_for_suggestions", "target": "dropdown", "value": "ul[role='listbox']", "description": "Wait for city suggestions"}},
  {{"action": "click", "target": "first_suggestion", "value": "li[role='option']:first-child", "description": "Select first city match"}}
]

Include:
- wait_for steps to ensure elements are loaded
- specific selectors (input[placeholder], aria-label, data-testid)
- steps to handle dropdowns, autocomplete, date pickers
- steps to extract results after search

Parameters to use: {json.dumps(parameters)}"""
    
    try:
        response = model.generate_content(system_prompt)

        if not getattr(response, "candidates", None):
            raise ValueError("No candidates returned from Gemini")

        candidate = response.candidates[0]
        finish_reason = getattr(candidate, "finish_reason", None)
        if finish_reason not in (None, 1):
            raise ValueError(f"Gemini did not finish normally (finish_reason={finish_reason})")

        try:
            content = candidate.content.parts[0].text.strip()
        except Exception:
            content = getattr(response, "text", "").strip()

        # Extract JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        steps = json.loads(content)
        return steps
        
    except Exception as e:
        print(f"Error generating navigation plan: {e}")
        return _generate_plan_fallback(website, parameters)


def _generate_plan_fallback(website: Dict, parameters: Dict) -> List[Dict]:
    """Fallback navigation plan generation"""
    url = website.get("url", "")
    
    # Google Flights specific plan
    if "google.com/flights" in url:
        steps = [
            {"action": "navigate", "target": "url", "value": url, "description": "Navigate to Google Flights"},
            {"action": "wait", "target": "element", "value": "3000", "description": "Wait for Google Flights to load"},
        ]
        
        if parameters.get("origin"):
            steps.extend([
                {"action": "click", "target": "input[placeholder*='Where from'], input[aria-label*='Where from']", "value": "", "description": "Click origin field"},
                {"action": "type", "target": "input[aria-label*='Where from'], input[placeholder*='Where from']", "value": parameters["origin"], "description": f"Enter origin city {parameters['origin']}"},
                {"action": "wait", "target": "suggestions", "value": "1", "description": "Wait for origin suggestions"},
                {"action": "click", "target": "li[role='option']:first-child", "value": "", "description": "Select first origin suggestion"},
            ])
        
        if parameters.get("destination"):
            steps.extend([
                {"action": "click", "target": "input[placeholder*='Where to'], input[aria-label*='Where to']", "value": "", "description": "Click destination field"},
                {"action": "type", "target": "input[aria-label*='Where to'], input[placeholder*='Where to']", "value": parameters["destination"], "description": f"Enter destination city {parameters['destination']}"},
                {"action": "wait", "target": "suggestions", "value": "1", "description": "Wait for destination suggestions"},
                {"action": "click", "target": "li[role='option']:first-child", "value": "", "description": "Select first destination suggestion"},
            ])

        # Departure date selection if available
        departure_date = parameters.get("departure_date")
        if departure_date and departure_date != "flexible":
            # Try to map YYYY-MM-DD into a month/day label used in aria-label
            label_fragment = departure_date
            try:
                year, month, day = map(int, departure_date.split("-"))
                month_names = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December",
                ]
                month_name = month_names[month - 1]
                label_fragment = f"{month_name[:3]} {day}"  # e.g. "Dec 5"
            except Exception:
                # Fall back to whatever string we got
                label_fragment = departure_date

            steps.extend([
                {"action": "click", "target": "button[aria-label*='Departure date'], div[aria-label*='Departure date']", "value": "", "description": "Open departure date picker"},
                {"action": "wait", "target": "calendar", "value": "1", "description": "Wait for date picker"},
                {"action": "click", "target": f"[aria-label*='{label_fragment}']", "value": "", "description": f"Select departure date {departure_date}"},
            ])
        
        steps.extend([
            {"action": "wait", "target": "search", "value": "1", "description": "Wait briefly before searching"},
            {"action": "click", "target": "button[aria-label*='Search'], button[aria-label*='Done']", "value": "", "description": "Click search flights"},
            {"action": "wait", "target": "results", "value": "5", "description": "Wait for flight results"},
            {"action": "extract_results", "target": "flights", "value": "", "description": "Extract flight options from results page"},
        ])
        
        return steps
    
    # Generic plan
    return [
        {"action": "navigate", "target": "url", "value": url, "description": f"Navigate to {website.get('name', 'website')}"},
        {"action": "wait", "target": "page", "value": "3000", "description": "Wait for page load"},
        {"action": "analyze_page", "target": "screenshot", "value": "", "description": "Analyze page to determine next steps"},
    ]
