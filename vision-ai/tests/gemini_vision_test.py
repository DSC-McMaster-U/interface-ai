"""
Gemini Vision-based element locator
Uses Gemini's multimodal vision capabilities to detect and locate UI elements
"""

import time
import os
import sys
import json
import re
from typing import List, Tuple, Optional
from google import genai
from PIL import Image
from common_utils import draw_bounding_boxes, format_bounding_boxes
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Load Gemini API key
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY")

# Global variable to cache Gemini client
_gemini_client = None


def parse_bounding_boxes_from_response(response_text: str) -> List[Tuple[int, int, int, int]]:
    """
    Parse bounding box coordinates from Gemini's response.
    Handles various response formats including JSON and natural language.
    
    Args:
        response_text: The text response from Gemini
    
    Returns:
        List of (x1, y1, x2, y2) tuples
    """
    bounding_boxes = []
    
    # Try to extract JSON first
    try:
        # Look for JSON blocks in the response
        json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
            data = json.loads(json_str)
            
            # Handle different JSON structures
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and 'bounding_box' in item:
                        box = item['bounding_box']
                        if isinstance(box, list) and len(box) == 4:
                            bounding_boxes.append(tuple(box))
                    elif isinstance(item, dict) and 'bbox' in item:
                        box = item['bbox']
                        if isinstance(box, list) and len(box) == 4:
                            bounding_boxes.append(tuple(box))
            elif isinstance(data, dict):
                if 'detections' in data:
                    for detection in data['detections']:
                        if 'bounding_box' in detection:
                            box = detection['bounding_box']
                            if isinstance(box, list) and len(box) == 4:
                                bounding_boxes.append(tuple(box))
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"Note: Could not parse as JSON ({e}), trying pattern matching...")
    
    # If JSON parsing failed, try pattern matching for coordinates
    if not bounding_boxes:
        # Look for patterns like (x1, y1, x2, y2) or [x1, y1, x2, y2]
        patterns = [
            r'\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)',  # (x1, y1, x2, y2)
            r'\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]',  # [x1, y1, x2, y2]
            r'x1[:\s=]+(\d+).*?y1[:\s=]+(\d+).*?x2[:\s=]+(\d+).*?y2[:\s=]+(\d+)',  # x1: 100 y1: 200 x2: 300 y2: 400
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, response_text, re.IGNORECASE | re.DOTALL)
            for match in matches:
                coords = [int(match.group(i)) for i in range(1, 5)]
                bounding_boxes.append(tuple(coords))
            if bounding_boxes:
                break
    
    return bounding_boxes


def find_elements_with_gemini(image_path: str, element_description: str, 
                               api_key: Optional[str] = None) -> Tuple[List[Tuple[int, int, int, int]], float]:
    """
    Use Gemini's vision model to detect and locate UI elements in an image.
    
    Args:
        image_path: Path to the input image
        element_description: Description of what to find (e.g., "home icon", "submit button")
        api_key: Gemini API key (if None, uses GEMINI_API_KEY)
    
    Returns:
        Tuple of (bounding_boxes, inference_time)
        bounding_boxes: List of (x1, y1, x2, y2) coordinates
        inference_time: Time taken for inference in seconds
    """
    global _gemini_client
    start_time = time.time()
    
    key_to_use = api_key or GEMINI_API_KEY
    if not key_to_use:
        raise ValueError("No Gemini API key provided")
    
    # Initialize Gemini client (only once)
    if _gemini_client is None:
        print("Initializing Gemini Vision client...")
        _gemini_client = genai.Client(api_key=key_to_use)
        print("Client initialized")
    
    # Load image
    print(f"\nAnalyzing image: {image_path}")
    print(f"Looking for: '{element_description}'")
    
    image = Image.open(image_path)
    width, height = image.size
    print(f"Image dimensions: {width}x{height}")
    
    # Craft prompt for element detection with stronger emphasis on precision
    prompt = f"""You are a precise UI element detection system. Analyze this screenshot carefully.

TASK: Locate ALL instances of: {element_description}

IMPORTANT INSTRUCTIONS:
1. Look at EVERY part of the image systematically
2. For icons, measure coordinates very carefully - icons are typically small (20-50 pixels)
3. Double-check your measurements before responding
4. If you see multiple similar items, return ALL of them
5. Image dimensions are {width}x{height} pixels

Return your findings in this EXACT JSON format:

```json
[
  {{
    "description": "what you see and its location (e.g., 'gear icon in bottom-left area')",
    "bounding_box": [x1, y1, x2, y2],
    "confidence": "high/medium/low",
    "row": "if applicable, which row (1=top row, 2=second row, etc)",
    "column": "if applicable, which column from left"
  }}
]
```

Where:
- x1, y1 = top-left corner in pixels (0,0 is top-left of image)
- x2, y2 = bottom-right corner in pixels
- Measure tightly around the element
- For a 30x30 icon at position (100, 200), box would be [100, 200, 130, 230]

If you cannot find any instances, return an empty array [].

BEFORE answering, think step by step:
1. What does a {element_description} typically look like?
2. Scan the image from top-left to bottom-right
3. Mark each location you find
4. Measure precise pixel coordinates for each"""

    try:
        # Call Gemini Vision API
        response = _gemini_client.models.generate_content(
            model='gemini-3-pro-preview',
            contents=[
                image,
                prompt
            ]
        )
        
        if not response or not response.text:
            raise ValueError("Empty response from Gemini API")
        
        response_text = response.text
        print("\n" + "="*60)
        print("Gemini Response:")
        print("="*60)
        print(response_text)
        print("="*60)
        
        # Parse bounding boxes from response
        bounding_boxes = parse_bounding_boxes_from_response(response_text)
        
        print(f"\n[DEBUG] Parsed {len(bounding_boxes)} bounding boxes from response")
        
        # Validate and filter bounding boxes
        valid_boxes = []
        for i, box in enumerate(bounding_boxes):
            x1, y1, x2, y2 = box
            
            print(f"[DEBUG] Box {i+1} raw: ({x1}, {y1}) to ({x2}, {y2}) - Size: {x2-x1}x{y2-y1}")
            
            # Ensure coordinates are within image bounds
            x1_clamped = max(0, min(x1, width))
            y1_clamped = max(0, min(y1, height))
            x2_clamped = max(0, min(x2, width))
            y2_clamped = max(0, min(y2, height))
            
            if (x1_clamped, y1_clamped, x2_clamped, y2_clamped) != (x1, y1, x2, y2):
                print(f"[DEBUG] Box {i+1} clamped to image bounds: ({x1_clamped}, {y1_clamped}) to ({x2_clamped}, {y2_clamped})")
            
            x1, y1, x2, y2 = x1_clamped, y1_clamped, x2_clamped, y2_clamped
            
            # Ensure x2 > x1 and y2 > y1
            if x2 > x1 and y2 > y1:
                # Filter out boxes that are too small (likely noise)
                box_width = x2 - x1
                box_height = y2 - y1
                box_area = box_width * box_height
                image_area = width * height
                area_ratio = box_area / image_area
                
                if box_width >= 5 and box_height >= 5:
                    # Also filter boxes that are suspiciously large (>50% of image)
                    if area_ratio > 0.5:
                        print(f"[WARNING] Box {i+1} is very large ({area_ratio*100:.1f}% of image) - possibly inaccurate")
                    valid_boxes.append((x1, y1, x2, y2))
                    print(f"[DEBUG] Box {i+1} ACCEPTED")
                else:
                    print(f"[DEBUG] Box {i+1} REJECTED - too small ({box_width}x{box_height})")
            else:
                print(f"[DEBUG] Box {i+1} REJECTED - invalid dimensions")
        
        inference_time = time.time() - start_time
        return valid_boxes, inference_time
        
    except Exception as e:
        print(f"Error calling Gemini Vision API: {e}")
        inference_time = time.time() - start_time
        return [], inference_time


def process_image(image_path: str, prompt: str, output_path: str):
    """
    Process a single image: detect elements using Gemini Vision and draw results.
    
    Args:
        image_path: Path to input image
        prompt: Description of what to find
        output_path: Path to save output image
    """
    bounding_boxes, inference_time = find_elements_with_gemini(image_path, prompt)
    
    print(f"\nFound {len(bounding_boxes)} matches for '{prompt}' in {inference_time:.3f}s")
    print(format_bounding_boxes(bounding_boxes))
    
    draw_bounding_boxes(image_path, bounding_boxes, prompt, inference_time, output_path)
    
    return bounding_boxes, inference_time


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python gemini_vision_test.py <image_path> <element_description> [output_path]")
        print("\nExamples:")
        print("  python gemini_vision_test.py input-images/input-icons.png \"home icon\"")
        print("  python gemini_vision_test.py input-images/input-youtube.png \"subscribe button\"")
        print("  python gemini_vision_test.py input-images/input-youtube.png \"video thumbnails\" output.png")
        print("\nNote: Set GEMINI_API_KEY environment variable.")
        print("Get your free API key from: https://aistudio.google.com/app/apikey")
        sys.exit(1)
    
    image_path = sys.argv[1]
    element_description = sys.argv[2]
    
    # Generate dynamic output path if not provided
    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    else:
        # Extract base filename without extension
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        # Remove "input-" prefix if present
        if base_name.startswith("input-"):
            base_name = base_name[6:]
        output_path = f"output-images/output-{base_name}.png"
    
    process_image(image_path, element_description, output_path)
