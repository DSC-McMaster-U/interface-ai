"""
Vision Pipeline
Combines Gemini 2.5 Flash, EasyOCR, and OpenCV to locate UI elements.
"""

import time
import os
import sys
import cv2
import json
import re
import warnings
import numpy as np
import easyocr
from typing import List, Tuple, Dict, Any
from google import genai
from PIL import Image
from common_utils import draw_bounding_boxes, format_bounding_boxes
from dotenv import load_dotenv

# Suppress memory warning for non-GPU environments
warnings.filterwarnings('ignore', message='.*pin_memory.*no accelerator.*')

# Load environment variables from the root .env file
root_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path=root_env_path)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found in .env file.")
    sys.exit(1)

_gemini_client = None
_ocr_reader = None

def init_services():
    global _gemini_client, _ocr_reader
    
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        
    if _ocr_reader is None:
        _ocr_reader = easyocr.Reader(['en'], gpu=True, verbose=False)

def analyze_intent_and_image(image_path: str, query: str) -> Dict[str, Any]:
    """Uses Gemini 2.5 Flash to determine target type (TEXT/ICON), synonyms, and spatial hint."""
    init_services()
    image = Image.open(image_path)
    width, height = image.size
    
    prompt = f"""Analyze this {width}x{height} pixel UI screenshot and the user query: "{query}"

Determine if the user is looking for a TEXT element or a graphical ICON.

Respond ONLY with a valid JSON object:
{{
    "target_type": "TEXT" or "ICON",
    "search_terms": ["list", "of", "3 to 5", "variations"],
    "location": "spatial hint (e.g., 'top-right')",
    "found": true or false
}}"""

    try:
        response = _gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image, prompt]
        )
        
        # Clean JSON format
        clean_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
            
        result = json.loads(clean_text)
        result['image_size'] = (width, height)
        
        return result
    except Exception as e:
        return {
            "target_type": "TEXT" if any(w in query.lower() for w in ['button', 'text', 'submit', 'login', 'read']) else "ICON",
            "search_terms": [query, query.lower()],
            "location": "center",
            "found": True,
            "image_size": (width, height)
        }

def find_text_with_ocr(image_path: str, query: str, search_terms: List[str]) -> List[Tuple[int, int, int, int]]:
    """Uses EasyOCR to find text bounding boxes matching the query or search terms."""
    init_services()
    results = _ocr_reader.readtext(image_path)
    
    exact_matches = []
    partial_matches = []
    terms_to_check = [t.lower() for t in search_terms] + [query.lower()]
    
    for bbox, text, conf in results:
        # Lowered confidence threshold drastically because small UI text 
        # (like "Log in") often gets scored ~0.2 - 0.3 by EasyOCR.
        if conf < 0.1:
            continue
            
        text_lower = text.lower()
        
        clean_text_no_punct = re.sub(r'[^\w\s]', '', text_lower).strip()
        clean_query = re.sub(r'[^\w\s]', '', query.lower()).strip()
        
        if clean_query == clean_text_no_punct or clean_query in clean_text_no_punct:
            x_coords = [p[0] for p in bbox]
            y_coords = [p[1] for p in bbox]
            exact_matches.append((int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))))
            continue
            
        is_match = False
        for term in terms_to_check:
            clean_term = re.sub(r'[^\w\s]', '', term).strip()
            if not clean_term: continue
            
            if clean_term in clean_text_no_punct or clean_text_no_punct in clean_term:
                if len(clean_term) <= 2 and clean_term != clean_text_no_punct:
                    continue  
                is_match = True
                break
                
        if is_match:
            x_coords = [p[0] for p in bbox]
            y_coords = [p[1] for p in bbox]
            partial_matches.append((int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))))
    
    return exact_matches if exact_matches else partial_matches

def find_icons_with_cv(image_path: str) -> List[Tuple[int, int, int, int]]:
    """Uses OpenCV blob and contour detection to find icon-like objects."""
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    bounding_boxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        aspect_ratio = w / h if h > 0 else 0
        
        if (10 <= w <= 200 and 10 <= h <= 200 and 0.3 <= aspect_ratio <= 3.0 and 50 <= area <= 20000):
            bounding_boxes.append((x, y, x + w, y + h))
            
    return bounding_boxes

def filter_by_spatial_hint(boxes: List[Tuple[int, int, int, int]], 
                           location_hint: str, 
                           image_size: Tuple[int, int]) -> List[Tuple[int, int, int, int]]:
    """Filters bounding boxes using Gemini's spatial hints by finding the closest match."""
    if not boxes: return []
    if len(boxes) == 1 or not location_hint: return [boxes[0]]
        
    width, height = image_size
    desc_lower = location_hint.lower()
    target_nx, target_ny = 0.5, 0.5
    
    row_match = re.search(r'row\s+(\d+)', desc_lower)
    col_match = re.search(r'column\s+(\d+)', desc_lower)
    
    if row_match or col_match:
        rows_match = re.search(r'(\d+)\s+rows', desc_lower)
        cols_match = re.search(r'(\d+)\s+columns', desc_lower)
        total_rows = int(rows_match.group(1)) if rows_match else 5
        total_cols = int(cols_match.group(1)) if cols_match else 8
        
        target_row = int(row_match.group(1)) if row_match else (total_rows // 2 + 1)
        target_col = int(col_match.group(1)) if col_match else (total_cols // 2 + 1)
        
        target_nx = (target_col - 0.5) / total_cols
        target_ny = (target_row - 0.5) / total_rows
    else:
        if 'top' in desc_lower: target_ny = 0.2
        elif 'bottom' in desc_lower: target_ny = 0.8
        
        if 'left' in desc_lower: target_nx = 0.2
        elif 'right' in desc_lower: target_nx = 0.8

    best_box = boxes[0]
    min_dist = float('inf')
    
    for x1, y1, x2, y2 in boxes:
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        nx, ny = cx / width, cy / height
        dist = np.sqrt((nx - target_nx)**2 + (ny - target_ny)**2)
        
        if dist < min_dist:
            min_dist = dist
            best_box = (x1, y1, x2, y2)
            
    if min_dist > 0.35 and len(boxes) > 1:
        return boxes
        
    return [best_box]

def escalate_to_pro(image_path: str, query: str, image_size: Tuple[int, int]) -> List[Tuple[int, int, int, int]]:
    """Escalates to Gemini 2.5 Pro for precise bounding box detection when Flash is ambiguous."""
    init_services()
    image = Image.open(image_path)
    width, height = image_size
    
    prompt = f"""Locate the exact bounding box for the UI element requested: "{query}".
Respond ONLY with a valid JSON array containing the bounding box coordinates scaled from 0 to 1000 (integers) in this exact format:
[ymin, xmin, ymax, xmax]
If the element cannot be found, respond with an empty array: []"""

    try:
        response = _gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image, prompt]
        )
        
        clean_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
        box_norm = json.loads(clean_text)
        
        if not box_norm or len(box_norm) < 4:
            return []
            
        ymin, xmin, ymax, xmax = float(box_norm[0])/1000.0, float(box_norm[1])/1000.0, float(box_norm[2])/1000.0, float(box_norm[3])/1000.0
        
        y1, x1 = int(ymin * height), int(xmin * width)
        y2, x2 = int(ymax * height), int(xmax * width)
        
        return [(x1, y1, x2, y2)]
    except Exception:
        return []

def deduplicate_boxes(boxes: List[Tuple[int, int, int, int]], threshold: int = 15) -> List[Tuple[int, int, int, int]]:
    """Removes overlapping or very near duplicate boxes."""
    unique_boxes = []
    for box in boxes:
        x1, y1, x2, y2 = box
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        is_duplicate = False
        
        for e_box in unique_boxes:
            ex1, ey1, ex2, ey2 = e_box
            ecx, ecy = (ex1 + ex2) / 2, (ey1 + ey2) / 2
            
            dist = np.sqrt((cx - ecx)**2 + (cy - ecy)**2)
            if dist < threshold:
                is_duplicate = True
                break
                
        if not is_duplicate:
            unique_boxes.append(box)
            
    return unique_boxes

def snap_to_nearest_box(target_box: Tuple[int, int, int, int], candidate_boxes: List[Tuple[int, int, int, int]]) -> List[Tuple[int, int, int, int]]:
    """Finds the candidate box whose center is closest to the target_box's center (Pro rough estimation fallback)."""
    if not candidate_boxes or not target_box:
        return [target_box] if target_box else []
        
    tx1, ty1, tx2, ty2 = target_box
    tcx, tcy = (tx1 + tx2) / 2, (ty1 + ty2) / 2
    
    closest_box = None
    min_dist = float('inf')
    
    for box in candidate_boxes:
        cx1, cy1, cx2, cy2 = box
        ccx, ccy = (cx1 + cx2) / 2, (cy1 + cy2) / 2
        dist = np.sqrt((tcx - ccx)**2 + (tcy - ccy)**2)
        
        if dist < min_dist:
            min_dist = dist
            closest_box = box
            
    if min_dist < 150:
        return [closest_box]
        
    return [target_box]

def find_element_unified(image_path: str, query: str) -> Tuple[List[Tuple[int, int, int, int]], float]:
    """Main pipeline combining Gemini Flash, OCR, and CV with Pro escalation."""
    start_time = time.time()
    
    ai_analysis = analyze_intent_and_image(image_path, query)
    target_type = ai_analysis.get('target_type', 'TEXT')
    search_terms = ai_analysis.get('search_terms', [query])
    
    query_lower = query.lower()
    fallback_expansions = {
        'settings': ['gear icon', 'cogwheel', 'cog icon', 'preferences icon'],
        'account': ['user icon', 'profile icon', 'person icon', 'avatar'],
        'home': ['house icon', 'home icon', 'building'],
        'search': ['magnifying glass', 'search icon', 'lens icon', 'search bar', 'search box', 'search input'],
        'menu': ['hamburger menu', 'three lines', 'navigation icon', 'menu bars'],
        'close': ['x icon', 'close icon', 'cancel icon', 'cross icon', 'close button'],
        'delete': ['trash icon', 'bin icon', 'garbage icon', 'delete icon'],
        'input': ['text box', 'input field', 'text field', 'search bar']
    }
    for key, synonyms in fallback_expansions.items():
        if key in query_lower:
            search_terms.extend(synonyms)
            
    location_hint = ai_analysis.get('location', '')
    image_size = ai_analysis.get('image_size', (0,0))
    
    boxes = []
    all_candidate_boxes = []
    
    if target_type == 'TEXT':
        all_candidate_boxes = find_text_with_ocr(image_path, query, search_terms)
        boxes = all_candidate_boxes
        
        if not boxes:
            all_candidate_boxes = find_icons_with_cv(image_path)
            boxes = filter_by_spatial_hint(all_candidate_boxes, location_hint, image_size)
            if boxes:
                boxes = [] 
        else:
            if len(boxes) > 1:
                boxes = filter_by_spatial_hint(boxes, location_hint, image_size)
    else: 
        all_candidate_boxes = find_icons_with_cv(image_path)
        boxes = filter_by_spatial_hint(all_candidate_boxes, location_hint, image_size)
        
        if not boxes:
            all_candidate_boxes = find_text_with_ocr(image_path, query, search_terms)
            boxes = all_candidate_boxes
            if len(boxes) > 1:
                boxes = filter_by_spatial_hint(boxes, location_hint, image_size)

    final_boxes = deduplicate_boxes(boxes)
    
    if len(final_boxes) != 1:
        pro_boxes = escalate_to_pro(image_path, query, image_size)
        
        if pro_boxes:
            final_boxes = deduplicate_boxes(pro_boxes)

    inference_time = time.time() - start_time
    return final_boxes, inference_time

def process_image(image_path: str, query: str, output_path: str):
    boxes, duration = find_element_unified(image_path, query)
    
    print(f"\n{'='*60}")
    print(f"FINAL RESULT: Found {len(boxes)} matches in {duration:.3f}s")
    print(format_bounding_boxes(boxes))
    print(f"{'='*60}")
    
    draw_bounding_boxes(image_path, boxes, query, duration, output_path)
    print(f"Output saved to: {output_path}")



