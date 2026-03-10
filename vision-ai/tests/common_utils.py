"""
Common utility functions for all scripts
"""

import os
from PIL import Image, ImageDraw, ImageFont
from typing import List, Tuple


def draw_bounding_boxes(image_path: str, bounding_boxes: List[Tuple[int, int, int, int]], 
                        prompt: str, inference_time: float, output_path: str):
    """
    Common function to draw bounding boxes on image with prompt and time information.
    
    Args:
        image_path: Path to input image
        bounding_boxes: List of bounding box coordinates (x1, y1, x2, y2)
        prompt: The search prompt used
        inference_time: Time taken for inference in seconds
        output_path: Path to save the output image
    """
    # Load image
    image = Image.open(image_path).convert('RGB')
    draw = ImageDraw.Draw(image)
    
    # Try to load a font, fallback to default if not available
    try:
        font = ImageFont.truetype("arial.ttf", 20)
        font_small = ImageFont.truetype("arial.ttf", 16)
    except:
        try:
            # Try alternative font paths
            font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
            font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 16)
        except:
            font = ImageFont.load_default()
            font_small = ImageFont.load_default()
    
    # Draw bounding boxes
    for x1, y1, x2, y2 in bounding_boxes:
        # Draw rectangle with red outline
        draw.rectangle([x1, y1, x2, y2], outline='red', width=3)
    
    # Add text overlay with prompt and time
    text_y = 10
    text_info = f"Prompt: {prompt}"
    # Draw text with white stroke for better visibility
    draw.text((10, text_y), text_info, fill='red', font=font, stroke_width=2, stroke_fill='white')
    
    text_y += 30
    time_info = f"Time: {inference_time:.3f}s"
    draw.text((10, text_y), time_info, fill='blue', font=font, stroke_width=2, stroke_fill='white')
    
    # Add count of detections
    text_y += 30
    count_info = f"Detections: {len(bounding_boxes)}"
    draw.text((10, text_y), count_info, fill='green', font=font, stroke_width=2, stroke_fill='white')
    
    # Save output
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    image.save(output_path)
    print(f"Results saved to: {output_path}")


def format_bounding_boxes(bounding_boxes: List[Tuple[int, int, int, int]]) -> str:
    """
    Format bounding boxes for console output.
    
    Args:
        bounding_boxes: List of bounding box coordinates
    
    Returns:
        Formatted string
    """
    if not bounding_boxes:
        return "  No detections found"
    
    lines = []
    for i, (x1, y1, x2, y2) in enumerate(bounding_boxes):
        lines.append(f"  Box {i+1}: ({x1}, {y1}) to ({x2}, {y2}) [W: {x2-x1}, H: {y2-y1}]")
    
    return "\n".join(lines)
