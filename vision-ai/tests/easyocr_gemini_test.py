"""
Gemini LLM + EasyOCR enhanced button locator
Uses Gemini to generate related button words, then searches for all variants using EasyOCR
"""

import easyocr
import cv2
import numpy as np
import time
import os
import warnings
from google import genai
from google.genai import types
from typing import List, Tuple, Optional
from common_utils import draw_bounding_boxes, format_bounding_boxes
from dotenv import load_dotenv

# Suppress EasyOCR CPU and PyTorch pin_memory warnings
warnings.filterwarnings('ignore', category=UserWarning, module='torch')
warnings.filterwarnings('ignore', message='.*CPU.*')

# Load environment variables from .env file
load_dotenv()

# Load Gemini API key
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found in .env file.")
    print("Please copy .env.example to .env and add your API key.")
    print("Get your free API key from: https://aistudio.google.com/app/apikey")
    raise ValueError("Missing GEMINI_API_KEY")

# Global variable to cache OCR reader
_ocr_reader = None


def generate_related_button_words(prompt: str, api_key: Optional[str] = None) -> List[str]:
    """
    Use Gemini LLM to generate 10 common words that may relate to the input word for UI buttons.
    
    Args:
        prompt: Input word (e.g., "submit")
        api_key: Gemini API key (if None, uses GEMINI_API_KEY)
    
    Returns:
        List of 11 words (original + 10 related words)
    """
    key_to_use = api_key or GEMINI_API_KEY
    if not key_to_use:
        print("Error: No Gemini API key provided. Returning only the original word.")
        return [prompt.lower()]
    
    # Create the client
    try:
        client = genai.Client(api_key=key_to_use)
    except Exception:
        raise Exception("Could not initialize Gemini client. Check your API key.")
    
    # Crafted prompt to ensure consistent output format
    system_prompt = """You are a UI/UX expert. Given a word that represents a button in a user interface, generate exactly 10 common alternative words or phrases that could be used for similar buttons in web or mobile applications.

The output must be in a specific format: a comma-separated list of exactly 10 words, nothing else. No explanations, no numbering, just the words separated by commas.

Example:
Input: "submit"
Output: ok, done, send, confirm, proceed, continue, save, apply, accept, finish

Input: "cancel"
Output: close, back, exit, dismiss, abort, undo, clear, reset, discard, remove

Now generate 10 alternatives for: "{prompt}"

Output format: word1, word2, word3, word4, word5, word6, word7, word8, word9, word10"""
    
    try:
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=system_prompt.format(prompt=prompt)
        )
        if not response or not response.text:
            raise ValueError("Empty response from Gemini API")
        text = response.text.strip()
        
        # Parse the response
        words = [w.strip().lower() for w in text.split(',')]
        words = [w for w in words if w]  # Remove empty strings
        
        # Ensure we have exactly 10 words, pad if needed
        while len(words) < 10:
            words.append("")
        words = words[:10]
        
        # Add the original word at the beginning
        result = [prompt.lower()] + words
        
        print(f"\n{'='*60}")
        print(f"Script 2: Searching for {len(result)} words:")
        print(f"  Original: '{result[0]}'")
        print(f"  Related words: {', '.join(result[1:])}")
        print(f"{'='*60}\n")
        return result
        
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        print("Returning only the original word.")
        return [prompt.lower()]


def find_button_by_text_variants(image_path: str, button_text: str, 
                                 related_words: Optional[List[str]] = None) -> Tuple[List[Tuple[int, int, int, int]], float]:
    """
    Find button locations by searching for the original text and related variants using EasyOCR.
    
    Args:
        image_path: Path to the input image
        button_text: Original text to search for
        related_words: List of related words to also search for (if None, will generate using Gemini)
    
    Returns:
        Tuple of (bounding_boxes, inference_time)
    """
    start_time = time.time()
    
    # Generate related words if not provided
    if related_words is None:
        related_words = generate_related_button_words(button_text)
    
    # Initialize EasyOCR reader
    global _ocr_reader
    if _ocr_reader is None:
        _ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    
    # Read image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image from {image_path}")
    
    # Perform OCR
    ocr_start = time.time()
    results = _ocr_reader.readtext(image)
    ocr_time = time.time() - ocr_start
    
    # Search for any of the words (case-insensitive)
    bounding_boxes = []
    search_words = [w.lower() for w in related_words if w]
    
    for (bbox, text, confidence) in results:
        text_lower = text.lower()
        for search_word in search_words:
            if search_word and search_word in text_lower:
                # bbox is in format [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                x_coords = [point[0] for point in bbox]
                y_coords = [point[1] for point in bbox]
                x1 = int(min(x_coords))
                y1 = int(min(y_coords))
                x2 = int(max(x_coords))
                y2 = int(max(y_coords))
                bounding_boxes.append((x1, y1, x2, y2))
                break  # Found a match, no need to check other words
    
    inference_time = time.time() - start_time
    
    return bounding_boxes, inference_time




def process_image(image_path: str, prompt: str, output_path: str):
    """
    Process a single image: generate related words, find buttons, and draw results.
    """
    bounding_boxes, inference_time = find_button_by_text_variants(image_path, prompt)
    
    print(f"Found {len(bounding_boxes)} matches for '{prompt}' and variants in {inference_time:.3f}s")
    print(format_bounding_boxes(bounding_boxes))
    
    draw_bounding_boxes(image_path, bounding_boxes, prompt, inference_time, output_path)
    
    return bounding_boxes, inference_time


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python easyocr_gemini_test.py <image_path> <button_text> [output_path]")
        print("Example: python easyocr_gemini_test.py input-images/input-youtube.png submit")
        print("\nNote: Set GEMINI_API_KEY environment variable.")
        sys.exit(1)
    
    image_path = sys.argv[1]
    button_text = sys.argv[2]
    
    # Generate dynamic output path if not provided
    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    else:
        # Extract base filename without extension
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        # Remove "input-" prefix if present
        if base_name.startswith("input-"):
            base_name = base_name[6:]  # Remove first 6 characters ("input-")
        output_path = f"output-images/output-{base_name}.png"
    
    process_image(image_path, button_text, output_path)
