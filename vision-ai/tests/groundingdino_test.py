"""
Grounding DINO-based object/icon locator
Locates objects and UI elements using Grounding DINO's zero-shot object detection
"""

import cv2
import numpy as np
import time
import os
import sys
import warnings
import logging
import torch
from PIL import Image
from typing import List, Tuple

# Set environment variables before importing transformers
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

# Suppress logging from transformers and huggingface_hub
logging.getLogger('transformers').setLevel(logging.ERROR)
logging.getLogger('huggingface_hub').setLevel(logging.ERROR)

from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
from common_utils import draw_bounding_boxes, format_bounding_boxes

# Suppress warnings
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore')

# Module-level variables to cache model and processor
_model = None
_processor = None


def preprocess_prompt(prompt: str) -> str:
    """
    Preprocess prompt for better Grounding DINO detection.
    Grounding DINO works best with simple noun phrases.
    """
    # Remove common words that confuse the model
    prompt = prompt.lower().strip()
    
    # Remove action words - keep only the object/icon name
    action_words = ['go', 'click', 'press', 'tap', 'select', 'find', 'show', 'get', 'open']
    words = prompt.split()
    filtered_words = [w for w in words if w not in action_words]
    
    if filtered_words:
        prompt = ' '.join(filtered_words)
    
    # Add period at end if not present (Grounding DINO expects this)
    if not prompt.endswith('.'):
        prompt = prompt + '.'
    
    return prompt


def find_objects_by_text(image_path: str, text_prompt: str, confidence_threshold: float = 0.25) -> Tuple[List[Tuple[int, int, int, int]], float]:
    """
    Find objects/icons based on text prompt using Grounding DINO.
    
    Args:
        image_path: Path to the input image
        text_prompt: Text description of what to find (e.g., "home icon", "settings button")
        confidence_threshold: Minimum confidence score (0-1) for detections
    
    Returns:
        Tuple of (bounding_boxes, inference_time)
        bounding_boxes: List of (x1, y1, x2, y2) coordinates
        inference_time: Time taken for inference in seconds
    """
    global _model, _processor
    start_time = time.time()
    
    # Initialize Grounding DINO model and processor (only once for efficiency)
    if _model is None or _processor is None:
        print("Initializing Grounding DINO (downloading model on first run - this may take a few minutes)...")
        model_id = "IDEA-Research/grounding-dino-base"
        
        _processor = AutoProcessor.from_pretrained(model_id)
        _model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id)
        
        # Use GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model.to(device)
        print(f"Model loaded on {device.upper()}")
    
    # Preprocess prompt for better results
    processed_prompt = preprocess_prompt(text_prompt)
    print(f"\nSearching for: '{text_prompt}' (processed as: '{processed_prompt}')")
    
    # Load and process image - convert to RGB to ensure compatibility
    image = Image.open(image_path).convert('RGB')
    
    # Prepare inputs
    inputs = _processor(images=image, text=processed_prompt, return_tensors="pt")
    
    # Move inputs to same device as model
    device = next(_model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    # Perform inference
    with torch.no_grad():
        outputs = _model(**inputs)
    
    # Post-process results - get ALL detections first
    all_results = _processor.post_process_grounded_object_detection(
        outputs,
        inputs["input_ids"],
        target_sizes=[image.size[::-1]],  # (height, width)
        threshold=0.1  # Very low threshold to see everything
    )[0]
    
    # Show all detections for debugging
    if len(all_results["boxes"]) > 0:
        print(f"\nAll detections (threshold=0.1):")
        for box, score, label in zip(all_results["boxes"], all_results["scores"], all_results["labels"]):
            print(f"  - '{label}': confidence {score:.3f}")
    else:
        print("\nNo detections found at any confidence level.")
    
    # Now filter by the user's confidence threshold
    results = _processor.post_process_grounded_object_detection(
        outputs,
        inputs["input_ids"],
        target_sizes=[image.size[::-1]],
        threshold=confidence_threshold
    )[0]
    
    # Get image dimensions for filtering
    img_width, img_height = image.size
    img_area = img_width * img_height
    
    # Extract bounding boxes above threshold and filter out invalid ones
    bounding_boxes = []
    if len(results["boxes"]) > 0:
        print(f"\nDetections above threshold ({confidence_threshold}):")
        for box, score, label in zip(results["boxes"], results["scores"], results["labels"]):
            x1, y1, x2, y2 = box.cpu().numpy().astype(int)
            
            # Calculate box dimensions
            box_width = x2 - x1
            box_height = y2 - y1
            box_area = box_width * box_height
            
            # Filter out boxes that are too large (likely false positives)
            # Skip boxes that cover more than 30% of the image
            area_ratio = box_area / img_area
            if area_ratio > 0.3:
                print(f"  ✗ Skipping '{label}' (confidence {score:.3f}) - box too large ({area_ratio*100:.1f}% of image)")
                continue
            
            # Skip boxes that are too small (likely noise)
            if box_width < 10 or box_height < 10:
                print(f"  ✗ Skipping '{label}' (confidence {score:.3f}) - box too small ({box_width}x{box_height})")
                continue
            
            # Skip boxes with very low aspect ratios (too wide or too tall relative to typical icons)
            aspect_ratio = max(box_width, box_height) / min(box_width, box_height)
            if aspect_ratio > 3:
                print(f"  ✗ Skipping '{label}' (confidence {score:.3f}) - unusual aspect ratio ({aspect_ratio:.1f}:1)")
                continue
            
            bounding_boxes.append((x1, y1, x2, y2))
            print(f"  ✓ '{label}' with confidence {score:.3f} - box size: {box_width}x{box_height}")
    else:
        print(f"\nNo detections above threshold ({confidence_threshold}).")
        print(f"Try lowering the confidence threshold or use a different prompt.")
    
    inference_time = time.time() - start_time
    
    return bounding_boxes, inference_time


def process_image(image_path: str, prompt: str, output_path: str, confidence_threshold: float = 0.25):
    """
    Process a single image: find objects and draw results.
    
    Args:
        image_path: Path to input image
        prompt: Text description of what to find
        output_path: Path to save output image
        confidence_threshold: Minimum confidence for detections
    """
    bounding_boxes, inference_time = find_objects_by_text(image_path, prompt, confidence_threshold)
    
    print(f"\nFound {len(bounding_boxes)} matches for '{prompt}' in {inference_time:.3f}s")
    print(format_bounding_boxes(bounding_boxes))
    
    draw_bounding_boxes(image_path, bounding_boxes, prompt, inference_time, output_path)
    
    return bounding_boxes, inference_time


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python groundingdino_test.py <image_path> <text_prompt> [output_path] [confidence_threshold]")
        print("Example: python groundingdino_test.py input-images/input-icons.png \"home icon\"")
        print("         python groundingdino_test.py input-images/input-icons.png \"settings button\" output.png 0.25")
        sys.exit(1)
    
    image_path = sys.argv[1]
    text_prompt = sys.argv[2]
    
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
    
    # Get confidence threshold if provided
    confidence_threshold = float(sys.argv[4]) if len(sys.argv) > 4 else 0.25
    
    process_image(image_path, text_prompt, output_path, confidence_threshold)
