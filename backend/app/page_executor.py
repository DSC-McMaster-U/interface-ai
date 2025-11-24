"""
Page Executor - Intelligently executes actions on dynamic web pages
Handles complex interactions, waits, and visual analysis
"""
import os
import json
import base64
from typing import Dict, List, Optional


class PageExecutor:
    """Executes automation steps with intelligent page analysis"""
    
    def __init__(self, api_key: str = None):
        # Use Google Gemini (GOOGLE_API_KEY) by default for LLM-powered analysis
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.execution_log = []
        self.page_state = {}
        
    def analyze_screenshot(self, screenshot_b64: str, context: str = "") -> Dict:
        """
        Analyze a screenshot to determine page state and next actions.
        
        Args:
            screenshot_b64: Base64 encoded screenshot
            context: Current context/goal
            
        Returns:
            Analysis with identified elements and suggested actions
        """
        try:
            import google.generativeai as genai
        except ImportError:
            return {"error": "Gemini (google-generativeai) not available"}
        
        if not self.api_key:
            return {"error": "No API key"}
        
        genai.configure(api_key=self.api_key)
        
        generation_config = {
            "temperature": 0.2,
            "top_p": 1,
            "top_k": 1,
            "max_output_tokens": 1500,
        }
        
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro-latest",
            generation_config=generation_config,
            safety_settings=safety_settings,
        )
        
        system_prompt = f"""You are a web automation vision expert. Analyze this screenshot and identify:

1. **Page Type**: What kind of page is this? (search form, results page, booking page, etc.)
2. **Interactive Elements**: List all clickable/typeable elements with:
   - Element type (button, input, link, dropdown, etc.)
   - Location description (top-left, center, near "X" text, etc.)
   - Purpose/label
   - Selector suggestions (id, class, aria-label, placeholder, etc.)
3. **Current State**: Is page fully loaded? Any loading indicators?
4. **Data Visible**: Any flight prices, times, options visible?
5. **Next Action**: What should we do next?

Context: {context}

Return ONLY valid JSON:
{{
  "page_type": "search_form",
  "fully_loaded": true,
  "elements": [
    {{
      "type": "input",
      "label": "From",
      "location": "top-left",
      "selector": "input[placeholder='Where from?']",
      "is_filled": false
    }}
  ],
  "extracted_data": {{
    "flights": [],
    "prices": []
  }},
  "suggested_action": {{
    "action": "click",
    "target": "input[placeholder='Where from?']",
    "reason": "Need to enter departure city"
  }}
}}"""
        
        try:
            # Gemini vision: pass text prompt and image data together
            response = model.generate_content([
                system_prompt,
                {
                    "mime_type": "image/png",
                    "data": base64.b64decode(screenshot_b64),
                },
            ])
            
            if not getattr(response, "candidates", None):
                raise ValueError("No candidates returned from Gemini vision model")
            
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
            
            analysis = json.loads(content)
            return analysis
            
        except Exception as e:
            print(f"Error analyzing screenshot: {e}")
            return {"error": str(e)}
    
    def find_element_intelligently(self, target_description: str, page_html: str = "", screenshot_analysis: Dict = None) -> Dict:
        """
        Intelligently find an element using multiple strategies.
        
        Args:
            target_description: Natural language description of element
            page_html: Optional page HTML
            screenshot_analysis: Optional visual analysis
            
        Returns:
            Best selector strategy and alternatives
        """
        try:
            import google.generativeai as genai
        except ImportError:
            return self._find_element_fallback(target_description)
        
        if not self.api_key:
            return self._find_element_fallback(target_description)
        
        genai.configure(api_key=self.api_key)
        
        generation_config = {
            "temperature": 0.1,
            "top_p": 1,
            "top_k": 1,
            "max_output_tokens": 300,
        }
        
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest",
            generation_config=generation_config,
            safety_settings=safety_settings,
        )
        
        context = ""
        if screenshot_analysis:
            context += f"Visual Analysis: {json.dumps(screenshot_analysis)}\n"
        if page_html:
            context += f"HTML Sample: {page_html[:2000]}\n"
        
        system_prompt = f"""You are a web element location expert. Find the best selector for: "{target_description}"

Return ONLY valid JSON with multiple selector strategies:
{{
  "primary_selector": "input[placeholder*='From']",
  "alternatives": [
    "input[aria-label*='departure']",
    "#departure-input",
    ".origin-field"
  ],
  "strategy": "placeholder",
  "confidence": 0.9,
  "wait_condition": "element.offsetParent !== null"
}}

Available info:
{context}"""
        
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
            
            return json.loads(content)
            
        except Exception as e:
            print(f"Error finding element: {e}")
            return self._find_element_fallback(target_description)
    
    def _find_element_fallback(self, target: str) -> Dict:
        """Fallback element finding"""
        target_lower = target.lower()
        
        # Common patterns
        if "from" in target_lower or "origin" in target_lower or "departure" in target_lower:
            return {
                "primary_selector": "input[placeholder*='from' i], input[aria-label*='from' i]",
                "alternatives": ["#origin", ".departure-input", "input[name*='origin']"],
                "strategy": "attribute_matching",
                "confidence": 0.6
            }
        elif "to" in target_lower or "destination" in target_lower or "arrival" in target_lower:
            return {
                "primary_selector": "input[placeholder*='to' i], input[aria-label*='to' i]",
                "alternatives": ["#destination", ".arrival-input", "input[name*='destination']"],
                "strategy": "attribute_matching",
                "confidence": 0.6
            }
        elif "search" in target_lower:
            return {
                "primary_selector": "button[type='submit'], button:contains('Search')",
                "alternatives": ["#search-btn", ".search-button", "input[type='submit']"],
                "strategy": "button_matching",
                "confidence": 0.7
            }
        else:
            # Generic fallback
            return {
                "primary_selector": f"*[aria-label*='{target}' i]",
                "alternatives": [f"*[placeholder*='{target}' i]", f"*[title*='{target}' i]"],
                "strategy": "text_matching",
                "confidence": 0.4
            }
    
    def generate_wait_strategy(self, step: Dict, page_analysis: Dict = None) -> Dict:
        """
        Generate intelligent wait strategy for a step.
        
        Args:
            step: The automation step
            page_analysis: Optional page analysis
            
        Returns:
            Wait configuration
        """
        action = step.get("action", "").lower()
        
        if action == "navigate":
            return {
                "type": "page_load",
                "condition": "document.readyState === 'complete'",
                "timeout": 30000,
                "also_wait_for": ["networkidle"]
            }
        elif action == "click":
            # After click, wait for potential navigation or content update
            return {
                "type": "dynamic",
                "condition": "element is not loading",
                "timeout": 5000,
                "also_wait_for": ["dom_mutation", "network_idle"]
            }
        elif action == "type":
            # After typing, wait for suggestions/autocomplete
            return {
                "type": "suggestions",
                "condition": "dropdown appears or debounce completes",
                "timeout": 2000,
                "also_wait_for": ["ul[role='listbox']", ".suggestions", ".autocomplete"]
            }
        elif "extract" in action or "analyze" in action:
            return {
                "type": "content_stable",
                "condition": "content stops changing",
                "timeout": 10000,
                "also_wait_for": ["!.loading", "!.spinner"]
            }
        else:
            return {
                "type": "simple",
                "condition": "time based",
                "timeout": 1000
            }
    
    def create_execution_script(self, step: Dict, element_info: Dict = None, wait_strategy: Dict = None) -> str:
        """
        Create JavaScript execution script for a step.
        
        Args:
            step: The automation step
            element_info: Element finding information
            wait_strategy: Wait configuration
            
        Returns:
            JavaScript code to execute
        """
        action = step.get("action", "").lower()
        target = step.get("target", "")
        value = step.get("value", "")
        
        # Use element_info selector if available
        selector = element_info.get("primary_selector", target) if element_info else target
        
        script = ""
        
        if action == "click":
            script = f"""
(function() {{
    const selectors = {json.dumps([selector] + element_info.get("alternatives", []) if element_info else [selector])};
    let element = null;
    
    for (const sel of selectors) {{
        try {{
            element = document.querySelector(sel);
            if (element && element.offsetParent !== null) break;
        }} catch(e) {{ continue; }}
    }}
    
    if (!element) return {{ success: false, error: 'Element not found' }};
    
    // Scroll into view
    element.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
    
    // Wait a bit for scroll
    return new Promise(resolve => {{
        setTimeout(() => {{
            // Highlight
            element.style.outline = '3px solid #667eea';
            setTimeout(() => {{ element.style.outline = ''; }}, 1000);
            
            // Click
            element.click();
            resolve({{ success: true, element: sel }});
        }}, 500);
    }});
}})();
"""
        elif action == "type":
            script = f"""
(function() {{
    const selectors = {json.dumps([selector] + element_info.get("alternatives", []) if element_info else [selector])};
    let element = null;
    
    for (const sel of selectors) {{
        try {{
            element = document.querySelector(sel);
            if (element && element.offsetParent !== null) break;
        }} catch(e) {{ continue; }}
    }}
    
    if (!element) return {{ success: false, error: 'Element not found' }};
    
    element.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
    
    return new Promise(resolve => {{
        setTimeout(() => {{
            element.focus();
            element.value = '';
            
            // Type character by character
            const text = {json.dumps(value)};
            let i = 0;
            const typeInterval = setInterval(() => {{
                if (i < text.length) {{
                    element.value += text[i];
                    element.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    i++;
                }} else {{
                    clearInterval(typeInterval);
                    element.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    resolve({{ success: true, typed: text }});
                }}
            }}, 50);
        }}, 500);
    }});
}})();
"""
        elif action == "extract_results":
            script = """
(function() {
    // Extract all visible flight information
    const results = [];
    
    // Try multiple selectors for flight cards
    const cardSelectors = [
        '.flight-result',
        '[data-test*="flight"]',
        '.result-item',
        'li[role="listitem"]',
        '.search-result'
    ];
    
    let cards = [];
    for (const sel of cardSelectors) {
        cards = Array.from(document.querySelectorAll(sel));
        if (cards.length > 0) break;
    }
    
    // Extract data from each card
    cards.slice(0, 10).forEach((card, idx) => {
        const getText = (sel) => card.querySelector(sel)?.textContent?.trim() || '';
        const price = card.textContent.match(/\\$[0-9,]+/)?.[0] || '';
        const times = card.textContent.match(/\\d{1,2}:\\d{2}\\s*[AP]M/gi) || [];
        
        results.push({
            id: `flight_${idx}`,
            price: price,
            departure_time: times[0] || '',
            arrival_time: times[1] || '',
            airline: getText('[data-test*="airline"], .airline, .carrier'),
            duration: getText('[data-test*="duration"], .duration, .flight-time'),
            html: card.innerHTML.substring(0, 500)
        });
    });
    
    return { success: true, flights: results, count: results.length };
})();
"""
        else:
            script = f"return {{ success: true, message: 'Action {action} completed' }};"
        
        return script
    
    def log_execution(self, step: Dict, result: Dict):
        """Log execution step and result"""
        self.execution_log.append({
            "step": step,
            "result": result,
            "timestamp": str(json.loads('{}'))  # Placeholder
        })
