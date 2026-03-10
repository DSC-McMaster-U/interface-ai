"""
EasyOCR-based button locator
Locates buttons based on text recognition using EasyOCR
"""

import easyocr
import cv2
import numpy as np
import time
import os
import warnings
from typing import List, Tuple, Optional
from common_utils import draw_bounding_boxes, format_bounding_boxes

# Suppress EasyOCR CPU and PyTorch pin_memory warnings
warnings.filterwarnings('ignore', category=UserWarning, module='torch')
warnings.filterwarnings('ignore', message='.*CPU.*')

# Module-level variable to cache the EasyOCR reader
_ocr_reader: Optional[easyocr.Reader] = None

def find_button_by_text(image_path: str, button_text: str) -> Tuple[List[Tuple[int, int, int, int]], float]:
    """
    Find button locations based on text recognition using EasyOCR.
    
    Args:
        image_path: Path to the input image
        button_text: Text to search for (e.g., "submit")
    
    Returns:
        Tuple of (bounding_boxes, inference_time)
        bounding_boxes: List of (x1, y1, x2, y2) coordinates
        inference_time: Time taken for inference in seconds
    """
    global _ocr_reader
    start_time = time.time()
    
    # Initialize EasyOCR reader (only once for efficiency)
    if _ocr_reader is None:
        print("Initializing EasyOCR (downloading models on first run - this may take a few minutes)...")
        _ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    
    # Read image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image from {image_path}")
    
    # Perform OCR
    results = _ocr_reader.readtext(image)
    
    # Search for the button text (case-insensitive)
    bounding_boxes = []
    button_text_lower = button_text.lower()
    
    for (bbox, text, confidence) in results:
        if button_text_lower in text.lower():
            # bbox is in format [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
            # Convert to (x1, y1, x2, y2) format
            x_coords = [point[0] for point in bbox]
            y_coords = [point[1] for point in bbox]
            x1 = int(min(x_coords))
            y1 = int(min(y_coords))
            x2 = int(max(x_coords))
            y2 = int(max(y_coords))
            bounding_boxes.append((x1, y1, x2, y2))
    
    inference_time = time.time() - start_time
    
    return bounding_boxes, inference_time


def process_image(image_path: str, prompt: str, output_path: str):
    """
    Process a single image: find button and draw results.
    
    Args:
        image_path: Path to input image
        prompt: Button text to search for
        output_path: Path to save output image
    """
    bounding_boxes, inference_time = find_button_by_text(image_path, prompt)
    
    print(f"Found {len(bounding_boxes)} matches for '{prompt}' in {inference_time:.3f}s")
    print(format_bounding_boxes(bounding_boxes))
    
    draw_bounding_boxes(image_path, bounding_boxes, prompt, inference_time, output_path)
    
    return bounding_boxes, inference_time


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python easyocr_test.py <image_path> <button_text> [output_path]")
        print("Example: python easyocr_test.py input-images/input-youtube.png submit")
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
