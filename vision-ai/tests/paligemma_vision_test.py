"""
PaliGemma Vision-based element locator
Uses PaliGemma's multimodal vision capabilities to detect and locate UI elements.
PaliGemma outputs bounding boxes as <loc> tokens natively via its detect task.
"""

import time
import os
import sys
import re
from typing import List, Tuple
import torch
from PIL import Image
from transformers import AutoProcessor, PaliGemmaForConditionalGeneration
from common_utils import draw_bounding_boxes, format_bounding_boxes

MODEL_ID = "google/paligemma2-3b-mix-448"

# Global variables to cache model and processor
_model = None
_processor = None


def parse_loc_tokens(response_text: str, img_width: int, img_height: int) -> List[Tuple[int, int, int, int]]:
    """
    Parse PaliGemma <loc> tokens into pixel bounding boxes.

    PaliGemma outputs detections as 4 consecutive <locXXXX> tokens per object,
    in the order: y1, x1, y2, x2 — normalized to a 0-1023 scale.

    Args:
        response_text: Model output containing <loc> tokens
        img_width: Original image width in pixels
        img_height: Original image height in pixels

    Returns:
        List of (x1, y1, x2, y2) pixel coordinate tuples
    """
    bounding_boxes = []

    # Each detection is 4 consecutive <locXXXX> tokens
    loc_groups = re.findall(r'(?:<loc(\d{4})>){4}', response_text)
    all_locs = re.findall(r'<loc(\d{4})>', response_text)

    # Group into sets of 4
    for i in range(0, len(all_locs) - 3, 4):
        y1_norm, x1_norm, y2_norm, x2_norm = [int(all_locs[i + j]) for j in range(4)]

        # Convert from 0-1023 normalized scale to pixel coordinates
        x1 = int(x1_norm / 1024 * img_width)
        y1 = int(y1_norm / 1024 * img_height)
        x2 = int(x2_norm / 1024 * img_width)
        y2 = int(y2_norm / 1024 * img_height)

        bounding_boxes.append((x1, y1, x2, y2))

    return bounding_boxes


def find_elements_with_paligemma(image_path: str, element_description: str) -> Tuple[List[Tuple[int, int, int, int]], float]:
    """
    Use PaliGemma's vision model to detect and locate UI elements in an image.

    Args:
        image_path: Path to the input image
        element_description: Description of what to find (e.g., "home icon", "submit button")

    Returns:
        Tuple of (bounding_boxes, inference_time)
        bounding_boxes: List of (x1, y1, x2, y2) pixel coordinates
        inference_time: Time taken for inference in seconds
    """
    global _model, _processor
    start_time = time.time()

    # Load model once
    if _model is None:
        print(f"Loading PaliGemma model: {MODEL_ID}")
        print("First run will download ~6GB — subsequent runs load from cache...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}")
        _processor = AutoProcessor.from_pretrained(MODEL_ID)
        _model = PaliGemmaForConditionalGeneration.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.bfloat16 if device == "cuda" else torch.float32,
        ).to(device).eval()
        print("Model loaded!")

    device = next(_model.parameters()).device

    # Load image
    print(f"\nAnalyzing image: {image_path}")
    print(f"Looking for: '{element_description}'")

    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    print(f"Image dimensions: {width}x{height}")

    # PaliGemma detect task — prefix "detect" triggers bounding box output
    prompt = f"detect {element_description}"

    inputs = _processor(text=prompt, images=image, return_tensors="pt").to(device)

    print("Running inference...")
    with torch.inference_mode():
        output_ids = _model.generate(
            **inputs,
            max_new_tokens=256,
            do_sample=False,
        )

    # Decode only the newly generated tokens (skip echoed prompt)
    input_len = inputs["input_ids"].shape[-1]
    response_text = _processor.decode(output_ids[0][input_len:], skip_special_tokens=False)

    print("\n" + "=" * 60)
    print("PaliGemma Response:")
    print("=" * 60)
    print(response_text)
    print("=" * 60)

    # Parse <loc> tokens into bounding boxes
    bounding_boxes = parse_loc_tokens(response_text, width, height)
    print(f"\n[DEBUG] Parsed {len(bounding_boxes)} bounding boxes")

    # Validate boxes
    valid_boxes = []
    for i, (x1, y1, x2, y2) in enumerate(bounding_boxes):
        print(f"[DEBUG] Box {i+1} raw: ({x1}, {y1}) to ({x2}, {y2}) - Size: {x2-x1}x{y2-y1}")

        x1 = max(0, min(x1, width))
        y1 = max(0, min(y1, height))
        x2 = max(0, min(x2, width))
        y2 = max(0, min(y2, height))

        if x2 > x1 and y2 > y1 and (x2 - x1) >= 5 and (y2 - y1) >= 5:
            valid_boxes.append((x1, y1, x2, y2))
            print(f"[DEBUG] Box {i+1} ACCEPTED")
        else:
            print(f"[DEBUG] Box {i+1} REJECTED - invalid or too small")

    inference_time = time.time() - start_time
    return valid_boxes, inference_time


def process_image(image_path: str, prompt: str, output_path: str):
    """
    Process a single image: detect elements using PaliGemma and draw results.

    Args:
        image_path: Path to input image
        prompt: Description of what to find
        output_path: Path to save output image
    """
    bounding_boxes, inference_time = find_elements_with_paligemma(image_path, prompt)

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
