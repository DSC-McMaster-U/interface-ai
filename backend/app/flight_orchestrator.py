"""
Flight Booking Orchestrator - Coordinates flight search, extraction, and comparison
"""
import os
import json
from typing import Dict, List, Optional
from web_navigator import search_for_best_website, extract_task_parameters, generate_navigation_plan


class FlightOrchestrator:
    """Orchestrates the entire flight booking process"""
    
    def __init__(self, api_key: str = None):
        # Use Google Gemini (GOOGLE_API_KEY) by default for LLM-powered steps
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.flight_options = []
        self.current_state = "initialized"
        
    def process_flight_request(self, user_intent: str) -> Dict:
        """
        Process a flight booking request from start to finish.
        
        Args:
            user_intent: User's natural language request
            
        Returns:
            Dictionary with navigation plan and next steps
        """
        # Step 1: Find the best website
        website_info = search_for_best_website(user_intent, self.api_key)
        
        # Step 2: Extract flight parameters
        parameters = extract_task_parameters(user_intent, "flight", self.api_key)
        
        # Step 3: Generate navigation plan
        nav_plan = generate_navigation_plan(
            user_intent, 
            website_info["recommended_site"],
            parameters,
            self.api_key
        )
        
        return {
            "status": "ready",
            "website": website_info["recommended_site"],
            "parameters": parameters,
            "navigation_plan": nav_plan,
            "message": f"Ready to search {website_info['recommended_site']['name']} for flights"
        }
    
    def extract_flight_options_from_page(self, page_content: str, screenshot_analysis: Dict = None) -> List[Dict]:
        """
        Extract flight options from page content or screenshot analysis.
        
        Args:
            page_content: HTML content or text from page
            screenshot_analysis: Analysis from vision AI
            
        Returns:
            List of flight options with details
        """
        try:
            import google.generativeai as genai
        except ImportError:
            return self._extract_options_fallback(page_content)
        
        if not self.api_key:
            return self._extract_options_fallback(page_content)
        
        genai.configure(api_key=self.api_key)
        
        generation_config = {
            "temperature": 0.1,
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
        
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest",
            generation_config=generation_config,
            safety_settings=safety_settings,
        )
        
        system_prompt = """You are a flight data extraction expert. Extract flight options from page content.

Return ONLY valid JSON array of flights:
[
  {
    "id": "unique_id",
    "airline": "airline name",
    "flight_number": "AA123",
    "departure_time": "HH:MM",
    "arrival_time": "HH:MM",
    "duration": "Xh YYm",
    "stops": 0,
    "price": "$XXX",
    "price_numeric": 299.99,
    "class": "economy",
    "amenities": ["wifi", "meals", etc],
    "layovers": ["ATL"],
    "ranking_score": 0.95
  }
]

If no flights found, return empty array []."""
        
        # Prepare content
        if screenshot_analysis:
            content = f"Screenshot Analysis:\n{json.dumps(screenshot_analysis)}\n\nPage Content:\n{page_content[:5000]}"
        else:
            content = page_content[:5000]
        
        prompt = f"{system_prompt}\n\n{content}"
        
        try:
            response = model.generate_content(prompt)
            
            if not getattr(response, "candidates", None):
                raise ValueError("No candidates returned from Gemini")
            
            candidate = response.candidates[0]
            finish_reason = getattr(candidate, "finish_reason", None)
            if finish_reason not in (None, 1):
                raise ValueError(f"Gemini did not finish normally (finish_reason={finish_reason})")
            
            # Extract text content
            try:
                result = candidate.content.parts[0].text.strip()
            except Exception:
                result = getattr(response, "text", "").strip()
            
            # Extract JSON
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()
            
            flights = json.loads(result)
            self.flight_options.extend(flights)
            return flights
            
        except Exception as e:
            print(f"Error extracting flights: {e}")
            return self._extract_options_fallback(page_content)
    
    def _extract_options_fallback(self, page_content: str) -> List[Dict]:
        """Fallback extraction using pattern matching"""
        import re
        
        # Simple price extraction
        price_pattern = r'\$(\d+(?:,\d{3})*(?:\.\d{2})?)'
        prices = re.findall(price_pattern, page_content)
        
        # Simple time extraction
        time_pattern = r'\b([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)\b'
        times = re.findall(time_pattern, page_content, re.IGNORECASE)
        
        flights = []
        for i, price in enumerate(prices[:5]):  # Top 5 results
            price_num = float(price.replace(',', ''))
            flights.append({
                "id": f"flight_{i+1}",
                "airline": "Unknown",
                "price": f"${price}",
                "price_numeric": price_num,
                "departure_time": times[i*2] if i*2 < len(times) else "TBD",
                "arrival_time": times[i*2+1] if i*2+1 < len(times) else "TBD",
                "ranking_score": 0.5
            })
        
        self.flight_options.extend(flights)
        return flights
    
    def rank_and_filter_flights(self, preferences: List[str] = None) -> List[Dict]:
        """
        Rank flights based on user preferences.
        
        Args:
            preferences: List of preferences like ["cheapest", "fastest", "direct"]
            
        Returns:
            Sorted list of flight options
        """
        if not self.flight_options:
            return []
        
        preferences = preferences or ["cheapest"]
        
        # Score each flight
        for flight in self.flight_options:
            score = 0.0
            
            # Price scoring (lower is better)
            if "cheapest" in preferences:
                price = flight.get("price_numeric", 999999)
                min_price = min(f.get("price_numeric", 999999) for f in self.flight_options)
                if min_price > 0:
                    score += (1.0 - (price - min_price) / min_price) * 0.4
            
            # Duration scoring (shorter is better)
            if "fastest" in preferences:
                duration_str = flight.get("duration", "10h 0m")
                hours = int(duration_str.split("h")[0].strip()) if "h" in duration_str else 0
                minutes = int(duration_str.split("h")[1].split("m")[0].strip()) if "m" in duration_str else 0
                total_minutes = hours * 60 + minutes
                score += (1.0 - min(total_minutes / 600, 1.0)) * 0.3
            
            # Direct flights preference
            if "direct" in preferences:
                stops = flight.get("stops", 1)
                score += (1.0 if stops == 0 else 0.0) * 0.3
            
            flight["ranking_score"] = score
        
        # Sort by ranking score
        sorted_flights = sorted(
            self.flight_options, 
            key=lambda f: f.get("ranking_score", 0),
            reverse=True
        )
        
        return sorted_flights
    
    def get_top_options(self, count: int = 5) -> Dict:
        """
        Get top flight options to present to user.
        
        Args:
            count: Number of options to return
            
        Returns:
            Dictionary with flight options and recommendation
        """
        if not self.flight_options:
            return {
                "status": "no_flights",
                "message": "No flights found",
                "options": []
            }
        
        top_flights = self.rank_and_filter_flights()[:count]
        
        # Generate recommendation
        recommendation = self._generate_recommendation(top_flights)
        
        return {
            "status": "options_ready",
            "message": "Found flight options. Which would you like to book?",
            "recommendation": recommendation,
            "options": top_flights,
            "count": len(top_flights)
        }
    
    def _generate_recommendation(self, flights: List[Dict]) -> str:
        """Generate a natural language recommendation"""
        if not flights:
            return "No flights available."
        
        best = flights[0]
        
        recommendation = f"I recommend {best.get('airline', 'this flight')} "
        recommendation += f"departing at {best.get('departure_time', 'TBD')} "
        recommendation += f"for {best.get('price', 'TBD')}. "
        
        if best.get("stops", 0) == 0:
            recommendation += "It's a direct flight. "
        
        if len(flights) > 1:
            cheapest = min(flights, key=lambda f: f.get("price_numeric", 99999))
            if cheapest != best:
                recommendation += f"The cheapest option is {cheapest.get('price', 'TBD')}. "
        
        return recommendation
    
    def select_flight(self, flight_id: str) -> Dict:
        """
        User selects a flight option.
        
        Args:
            flight_id: ID of the selected flight
            
        Returns:
            Next steps for booking
        """
        selected = next((f for f in self.flight_options if f.get("id") == flight_id), None)
        
        if not selected:
            return {
                "status": "error",
                "message": "Flight not found"
            }
        
        return {
            "status": "flight_selected",
            "flight": selected,
            "message": f"Selected {selected.get('airline', 'flight')} for {selected.get('price', 'TBD')}",
            "next_steps": [
                {"action": "click", "target": f"flight_{flight_id}", "description": "Click on selected flight"},
                {"action": "wait", "target": "booking_page", "description": "Wait for booking page"},
                {"action": "notify_user", "target": "confirmation", "description": "Notify user to complete booking"}
            ]
        }
    
    def get_status(self) -> Dict:
        """Get current orchestrator status"""
        return {
            "state": self.current_state,
            "flights_found": len(self.flight_options),
            "has_options": len(self.flight_options) > 0
        }


def create_flight_orchestrator(intent: str) -> Dict:
    """
    Convenience function to create and run flight orchestrator.
    
    Args:
        intent: User's flight booking intent
        
    Returns:
        Complete flight search plan
    """
    orchestrator = FlightOrchestrator()
    return orchestrator.process_flight_request(intent)
