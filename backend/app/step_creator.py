"""
Step Creator - Breaks down high-level user intents into actionable browser automation steps
"""
import os
from typing import List, Dict
import json


def create_steps_with_openai(user_intent: str, api_key: str = None) -> List[Dict[str, str]]:
    """
    Uses OpenAI API to break down user intent into steps.
    
    Args:
        user_intent: The high-level task the user wants to accomplish
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
    
    Returns:
        List of step dictionaries with 'action' and 'description' keys
    """
    try:
        from openai import OpenAI
    except ImportError:
        print("OpenAI library not installed. Run: pip install openai")
        return []
    
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not found in environment")
        return []
    
    client = OpenAI(api_key=api_key)
    
    system_prompt = """You are a web automation task planner. Break down high-level user intents into specific, actionable browser automation steps.

Each step should be atomic and clear. Focus on what needs to be done, not how to implement it technically.

Return ONLY a JSON array of steps. Each step should have:
- "action": the type of action (navigate, search, click, type, wait, scroll, etc.)
- "target": what element or location to interact with
- "value": any value to input (for type actions) or additional context
- "description": human-readable description

Example for "book a flight from Toronto to NYC":
[
  {"action": "navigate", "target": "flight booking website", "value": "google.com/flights", "description": "Navigate to Google Flights"},
  {"action": "click", "target": "departure input", "value": "", "description": "Click on the departure city input field"},
  {"action": "type", "target": "departure input", "value": "Toronto", "description": "Type 'Toronto' in departure field"},
  {"action": "click", "target": "destination input", "value": "", "description": "Click on the destination city input field"},
  {"action": "type", "target": "destination input", "value": "New York City", "description": "Type 'New York City' in destination field"},
  {"action": "click", "target": "search button", "value": "", "description": "Click the search button to find flights"}
]

Keep steps simple and sequential. Don't assume login credentials or personal information unless explicitly provided."""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Break down this task into steps: {user_intent}"}
            ],
            temperature=0.3,
            max_tokens=1500
        )
        
        content = response.choices[0].message.content.strip()
        
        # Try to extract JSON from the response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        steps = json.loads(content)
        return steps
        
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        return []


def create_steps_with_gemini(user_intent: str, api_key: str = None) -> List[Dict[str, str]]:
    """
    Uses Google Gemini API to break down user intent into steps.
    
    Args:
        user_intent: The high-level task the user wants to accomplish
        api_key: Google API key (defaults to GOOGLE_API_KEY env var)
    
    Returns:
        List of step dictionaries
    """
    try:
        import google.generativeai as genai
    except ImportError:
        print("Google Generative AI library not installed. Run: pip install google-generativeai")
        return []
    
    api_key = api_key or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in environment")
        return []
    
    genai.configure(api_key=api_key)
    
    generation_config = {
        "temperature": 0.3,
        "top_p": 1,
        "top_k": 1,
        "max_output_tokens": 2048,
    }
    
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    
    model = genai.GenerativeModel(
        model_name='gemini-1.5-flash-latest',
        generation_config=generation_config,
        safety_settings=safety_settings
    )
    
    prompt = f"""You are a browser automation planner.

Convert this task into a sequence of concrete, on-page actions as a JSON array.

Task: {user_intent}

Rules:
- Use only these action types: "navigate", "search", "click", "type", "wait", "scroll", "ask_user".
- "navigate": change the page URL (e.g. go to a specific site like google.com/flights or dominos.ca).
- "search": perform a web search (e.g. on Google) using the given query.
- "click": click a specific element on the current page.
- "type": type text into a specific element on the current page.
- "wait": wait for N seconds before the next action (put N as a number of seconds in "value").
- "scroll": scroll the page (e.g. "down" or "up" in "target").
- "ask_user": when you need more details (e.g. toppings, size, date flexibility), ask the user a question in "description" and put a short machine-friendly key in "value" (e.g. "pizza_preferences").

For each step, output an object:
{{
  "action": "navigate|search|click|type|wait|scroll|ask_user",
  "target": "CSS-like selector or high-level element description",
  "value": "text to type / URL / seconds / optional key for ask_user",
  "description": "clear human-readable description of what happens on screen"
}}

Prefer real websites and concrete flows. For example:
- For flights, prefer Google Flights (google.com/flights), Kayak, or Skyscanner.
- For ordering pizza from Dominos, navigate directly to https://www.dominos.ca first.
- For food orders (pizza, restaurants), ALWAYS include at least one "ask_user" step early on asking exactly what the user wants to order and any preferences (size, toppings, sides, drinks).
- For flights, ALWAYS include at least one "ask_user" step if the user intent does not clearly specify whether they prefer the cheapest option, the fastest option, and whether they require direct flights only.
- Use multiple steps that actually navigate, click, and type on the page.
- Insert "ask_user" steps whenever additional user choices are needed.

Return only the JSON array."""
    
    try:
        response = model.generate_content(prompt)
        
        # Check if response was blocked
        if not response.candidates:
            print(f"Error calling Gemini API: No candidates returned")
            return []
        
        candidate = response.candidates[0]
        if candidate.finish_reason != 1:  # 1 = STOP (normal completion)
            print(f"Error calling Gemini API: Response blocked (finish_reason={candidate.finish_reason})")
            return []
        
        content = candidate.content.parts[0].text.strip()
        
        # Try to extract JSON from the response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        steps = json.loads(content)
        return steps
        
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return []


def create_steps_with_anthropic(user_intent: str, api_key: str = None) -> List[Dict[str, str]]:
    """
    Uses Anthropic Claude API to break down user intent into steps.
    
    Args:
        user_intent: The high-level task the user wants to accomplish
        api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
    
    Returns:
        List of step dictionaries
    """
    try:
        from anthropic import Anthropic
    except ImportError:
        print("Anthropic library not installed. Run: pip install anthropic")
        return []
    
    api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found in environment")
        return []
    
    client = Anthropic(api_key=api_key)
    
    prompt = """Break down this high-level user intent into specific, actionable browser automation steps.

Each step should be atomic and clear. Return ONLY a JSON array of steps. Each step should have:
- "action": the type of action (navigate, search, click, type, wait, scroll, etc.)
- "target": what element or location to interact with
- "value": any value to input or additional context
- "description": human-readable description

User intent: {intent}

Return only the JSON array, no other text."""
    
    try:
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1500,
            temperature=0.3,
            messages=[
                {"role": "user", "content": prompt.format(intent=user_intent)}
            ]
        )
        
        content = message.content[0].text.strip()
        
        # Try to extract JSON from the response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        steps = json.loads(content)
        return steps
        
    except Exception as e:
        print(f"Error calling Anthropic API: {e}")
        return []


def create_steps_fallback(user_intent: str) -> List[Dict[str, str]]:
    """
    Fallback method using basic pattern matching when no API is available.
    This is a simple demo - not as sophisticated as LLM-based approach.
    """
    intent_lower = user_intent.lower()
    steps = []
    
    # Pattern: "message [person] on [platform]"
    if "message" in intent_lower or "dm" in intent_lower:
        platform = "Instagram" if "instagram" in intent_lower else "unknown platform"
        steps = [
            {"action": "search", "target": "google", "value": platform, "description": f"Search for {platform}"},
            {"action": "click", "target": "first link", "value": "", "description": f"Click on first {platform} link"},
            {"action": "wait", "target": "page load", "value": "3", "description": "Wait for page to load"},
            {"action": "click", "target": "messages icon", "value": "", "description": "Click on messages/DM icon"},
            {"action": "click", "target": "first message", "value": "", "description": "Click on first/most recent message"},
            {"action": "click", "target": "text input", "value": "", "description": "Click on text input field"},
            {"action": "type", "target": "text input", "value": "hello", "description": "Type the message"},
            {"action": "click", "target": "send button", "value": "", "description": "Click send button"}
        ]
    
    # Pattern: "book a flight"
    elif "book" in intent_lower and "flight" in intent_lower:
        steps = [
            {"action": "navigate", "target": "flight booking site", "value": "google.com/flights", "description": "Navigate to flight booking website"},
            {"action": "click", "target": "departure input", "value": "", "description": "Click departure city field"},
            {"action": "type", "target": "departure input", "value": "departure city", "description": "Enter departure city"},
            {"action": "click", "target": "destination input", "value": "", "description": "Click destination city field"},
            {"action": "type", "target": "destination input", "value": "destination city", "description": "Enter destination city"},
            {"action": "click", "target": "search button", "value": "", "description": "Search for flights"}
        ]

    # Pattern: "order pizza from Dominos"
    elif "pizza" in intent_lower and ("dominos" in intent_lower or "domino's" in intent_lower):
        steps = [
            {"action": "navigate", "target": "https://www.dominos.ca", "value": "", "description": "Navigate directly to Dominos Canada website"},
            {"action": "wait", "target": "page load", "value": "3", "description": "Wait for the Dominos homepage to load"},
            {"action": "click", "target": "button 'Order Online'", "value": "", "description": "Click the 'Order Online' button"}
        ]
    
    # Pattern: "open [something]"
    elif "open" in intent_lower:
        target = user_intent.split("open")[-1].strip()
        steps = [
            {"action": "search", "target": "google", "value": target, "description": f"Search for '{target}'"},
            {"action": "click", "target": "first result", "value": "", "description": "Click on first search result"}
        ]
    
    # Generic fallback
    else:
        steps = [
            {"action": "search", "target": "google", "value": user_intent, "description": f"Search Google for '{user_intent}'"},
            {"action": "wait", "target": "results", "value": "2", "description": "Wait for search results"},
            {"action": "analyze", "target": "page", "value": "", "description": "Analyze page to determine next action"}
        ]
    
    return steps


def create_steps(user_intent: str, provider: str = "auto") -> List[Dict[str, str]]:
    """
    Main function to create steps from user intent.
    
    Args:
        user_intent: The high-level task to break down
        provider: AI provider to use ("gemini", "openai", "anthropic", "fallback", or "auto")
    
    Returns:
        List of step dictionaries
    """
    if provider == "auto":
        # Try Gemini first, then OpenAI, then Anthropic, then fallback
        if os.getenv("GOOGLE_API_KEY"):
            provider = "gemini"
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
        elif os.getenv("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        else:
            provider = "fallback"
    
    if provider == "gemini":
        steps = create_steps_with_gemini(user_intent)
    elif provider == "openai":
        steps = create_steps_with_openai(user_intent)
    elif provider == "anthropic":
        steps = create_steps_with_anthropic(user_intent)
    else:
        steps = create_steps_fallback(user_intent)
    
    return steps


def print_steps(steps: List[Dict[str, str]]):
    """Pretty print the steps"""
    if not steps:
        print("No steps generated.")
        return
    
    print("\n" + "="*60)
    print("GENERATED STEPS")
    print("="*60)
    for i, step in enumerate(steps, 1):
        print(f"\nStep {i}:")
        print(f"  Action: {step.get('action', 'N/A')}")
        print(f"  Target: {step.get('target', 'N/A')}")
        if step.get('value'):
            print(f"  Value: {step.get('value')}")
        print(f"  Description: {step.get('description', 'N/A')}")
    print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    import sys
    
    # Example intents to try
    example_intents = [
        "message my first instagram DM hello",
        "book a flight from Toronto to New York",
        "open my calculus lecture on YouTube",
        "create a new AWS EC2 instance",
        "order pizza from Dominos"
    ]
    
    print("Step Creator Demo")
    print("=" * 60)
    print("\nThis demo breaks down high-level user intents into actionable steps.")
    print("\nAvailable AI providers:")
    print("  - Gemini (requires GOOGLE_API_KEY env var)")
    print("  - OpenAI (requires OPENAI_API_KEY env var)")
    print("  - Anthropic (requires ANTHROPIC_API_KEY env var)")
    
    # Check what's available
    has_gemini = bool(os.getenv("GOOGLE_API_KEY"))
    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    has_anthropic = bool(os.getenv("ANTHROPIC_API_KEY"))
    
    print(f"\nDetected API keys:")
    print(f"  Gemini: {'✓' if has_gemini else '✗'}")
    print(f"  OpenAI: {'✓' if has_openai else '✗'}")
    print(f"  Anthropic: {'✓' if has_anthropic else '✗'}")
    
    if not has_gemini and not has_openai and not has_anthropic:
        print("\n⚠ No API keys found. Using fallback mode (limited capabilities).")
        print("Set GOOGLE_API_KEY (Gemini), OPENAI_API_KEY, or ANTHROPIC_API_KEY for better results.\n")
        print("Set OPENAI_API_KEY or ANTHROPIC_API_KEY for better results.\n")
    
    print("\n" + "=" * 60)
    
    # If user provided intent as argument
    if len(sys.argv) > 1:
        user_intent = " ".join(sys.argv[1:])
        print(f"\nUser Intent: {user_intent}")
        steps = create_steps(user_intent)
        print_steps(steps)
    else:
        # Demo mode - show examples
        print("\nDemo mode - showing example intents:\n")
        for i, intent in enumerate(example_intents, 1):
            print(f"\n{'#' * 60}")
            print(f"Example {i}: {intent}")
            print('#' * 60)
            steps = create_steps(intent)
            print_steps(steps)
            
            if i < len(example_intents):
                input("Press Enter to continue to next example...")
        
        print("\n" + "=" * 60)
        print("To test with your own intent, run:")
        print("  python step_creator.py 'your intent here'")
        print("=" * 60)
