"""
Unified Pipeline: Gemini 2.5 Flash + EasyOCR + OpenCV
]It dynamically determines whether to search for TEXT or an ICON/VISUAL element,
running the appropriate detection layer (EasyOCR or OpenCV) and filtering
by Gemini's spatial understanding of the screen.
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

# Suppress pin_memory warning when GPU is not available
warnings.filterwarnings('ignore', message='.*pin_memory.*no accelerator.*')

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found in .env file.")
    sys.exit(1)

# Initialize clients globally to reuse across runs if imported
_gemini_client = None
_ocr_reader = None

def init_services():
    global _gemini_client, _ocr_reader
    
    if _gemini_client is None:
        print("[System] Initializing Gemini GenAI Client...")
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        
    if _ocr_reader is None:
        print("[System] Initializing EasyOCR (this may take a moment on first run)...")
        # gpu=True allows hardware acceleration if a CUDA GPU is available, else it smoothly falls back to CPU
        _ocr_reader = easyocr.Reader(['en'], gpu=True, verbose=False)

def analyze_intent_and_image(image_path: str, query: str) -> Dict[str, Any]:
    """
    Use Gemini 2.5 Flash to analyze the query AND the exact image in one call.
    Returns JSON with target_type (TEXT/ICON), search_terms, and location_hint.
    """
    init_services()
    image = Image.open(image_path)
    width, height = image.size
    
    prompt = f"""Analyze this {width}x{height} pixel UI screenshot and the user query: "{query}"

You are an expert Vision AI router. Your job is to determine how we should locate this element.

Determine if the user is looking for a TEXT element (like a button with words, a link, a paragraph, or a label) 
or a graphical ICON (like a gear, profile picture, logo, or hamburger menu).

Respond ONLY with a valid JSON object containing exactly these properties:
{{
    "target_type": "TEXT" or "ICON",
    "search_terms": ["list", "of", "3 to 5", "variations", "or synonyms"],
    "location": "A spatial hint describing where it is on screen (e.g., 'top-right', 'bottom-center', or 'row 3, column 2')",
    "found": true or false
}}

Make sure the JSON is perfectly formatted. Do not include markdown code block backticks."""

    try:
        response = _gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image, prompt]
        )
        
        # Clean up JSON formatting if it used markdown blocks
        clean_text = response.text.strip()
        if clean_text.startswith("```json"): clean_text = clean_text[7:]
        elif clean_text.startswith("```"): clean_text = clean_text[3:]
        if clean_text.endswith("```"): clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
            
        result = json.loads(clean_text)
        result['image_size'] = (width, height)
        
        print("\n" + "="*60)
        print("Gemini Analysis:")
        print(f"  Target Type:   {result.get('target_type')}")
        print(f"  Search Terms:  {', '.join(result.get('search_terms', []))}")
        print(f"  Location Hint: {result.get('location')}")
        print(f"  Found in img:  {result.get('found')}")
        print("="*60)
        
        return result
    except Exception as e:
        print(f"\n[Warning] Failed to parse Gemini response: {e}")
        try: print(f"Raw Output: {response.text}")
        except: pass
        return {
            "target_type": "TEXT" if any(w in query.lower() for w in ['button', 'text', 'submit', 'login', 'read']) else "ICON",
            "search_terms": [query, query.lower()],
            "location": "center",
            "found": True,
            "image_size": (width, height)
        }

def find_text_with_ocr(image_path: str, query: str, search_terms: List[str]) -> List[Tuple[int, int, int, int]]:
    """
    Use EasyOCR to find text bounding boxes matching the query or search terms.
    """
    init_services()
    print(f"\n[OCR Layer] Scanning for text variations...")
    results = _ocr_reader.readtext(image_path)
    
    exact_matches = []
    partial_matches = []
    
    terms_to_check = [t.lower() for t in search_terms] + [query.lower()]
    
    for bbox, text, conf in results:
        if conf < 0.4:
            # Skip low-confidence OCR matches to avoid garbage UI artifacts
            continue
            
        text_lower = text.lower()
        
        # Priority 1: Exact Query Match
        # Strip all outer punctuation or spaces to give OCR a very generous clean string
        clean_text_no_punct = re.sub(r'[^\w\s]', '', text_lower).strip()
        clean_query = re.sub(r'[^\w\s]', '', query.lower()).strip()
        
        if clean_query == clean_text_no_punct or clean_query in clean_text_no_punct:
            x_coords = [p[0] for p in bbox]
            y_coords = [p[1] for p in bbox]
            exact_matches.append((int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))))
            print(f"  └─ Exact Query Match: '{text}' (conf: {conf:.2f})")
            continue
            
        # Priority 2: Term Variation Matches & Partial Matching
        is_match = False
        for term in terms_to_check:
            clean_term = re.sub(r'[^\w\s]', '', term).strip()
            if not clean_term: continue
            
            # Reverting back to fuzzy/partial matching because strict exact matching fails on spaces/punctuation
            if clean_term in clean_text_no_punct or clean_text_no_punct in clean_term:
                if len(clean_term) <= 2 and clean_term != clean_text_no_punct:
                    continue  # Ignore random 1-2 letter noise
                is_match = True
                print(f"  └─ Partial/Term Match: '{text}' (conf: {conf:.2f})")
                break
                
        if is_match:
            x_coords = [p[0] for p in bbox]
            y_coords = [p[1] for p in bbox]
            partial_matches.append((int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))))
    
    # Return exact matches if found, otherwise return partial matches
    if exact_matches:
        print(f"[OCR Layer] Extracted {len(exact_matches)} HIGH CONFIDENCE exact text boxes.")
        return exact_matches
    elif partial_matches:
        print(f"[OCR Layer] Extracted {len(partial_matches)} partial/fuzzy text matches.")
        return partial_matches
        
    print(f"[OCR Layer] Extracted 0 matches. Returning empty list.")
    return []

def find_icons_with_cv(image_path: str) -> List[Tuple[int, int, int, int]]:
    """
    Use OpenCV blob and contour detection to find icon-like objects.
    """
    print(f"\n[CV Layer] Scanning for structural icons/blobs...")
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Invert for contour detection (if icons are dark on light bg)
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    bounding_boxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        aspect_ratio = w / h if h > 0 else 0
        
        # Filter heuristics for typical icons/UI elements
        if (10 <= w <= 200 and 10 <= h <= 200 and 
            0.3 <= aspect_ratio <= 3.0 and
            50 <= area <= 20000):
            bounding_boxes.append((x, y, x + w, y + h))
            
    print(f"[CV Layer] Extracted {len(bounding_boxes)} potential icon blobs.")
    return bounding_boxes

def filter_by_spatial_hint(boxes: List[Tuple[int, int, int, int]], 
                           location_hint: str, 
                           image_size: Tuple[int, int]) -> List[Tuple[int, int, int, int]]:
    """
    Filter a generic list of bounding boxes using Gemini's spatial hints by finding the closest match.
    Always reduces down to 1 most likely box to prevent unnecessary Pro escalation.
    """
    if not boxes:
        return []
    if len(boxes) == 1 or not location_hint:
        return [boxes[0]]
        
    width, height = image_size
    desc_lower = location_hint.lower()
    
    # Default to center if hint is unparseable
    target_nx, target_ny = 0.5, 0.5
    
    # Check for Grid patterns (e.g. "row 2, column 4")
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
        # Region mapping
        if 'top' in desc_lower: target_ny = 0.2
        elif 'bottom' in desc_lower: target_ny = 0.8
        
        if 'left' in desc_lower: target_nx = 0.2
        elif 'right' in desc_lower: target_nx = 0.8

    # Find the box closest to our target region
    best_box = boxes[0]
    min_dist = float('inf')
    
    for x1, y1, x2, y2 in boxes:
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        nx, ny = cx / width, cy / height
        # Euclidean distance in normalized space
        dist = np.sqrt((nx - target_nx)**2 + (ny - target_ny)**2)
        
        if dist < min_dist:
            min_dist = dist
            best_box = (x1, y1, x2, y2)
            
    # If the closest box is VERY far away from Flash's guess, Flash might have hallucinated.
    # Return multiple to trigger Pro Escalation instead of blindly trusting a bad guess.
    if min_dist > 0.35 and len(boxes) > 1:
        print(f"[Filter] Semantic hint was too far ({min_dist:.2f} away) from any candidates. Keeping all {len(boxes)} to trigger Pro.")
        return boxes
        
    print(f"[Filter] Semantic hint narrowed {len(boxes)} matches down to 1.")
    return [best_box]

def escalate_to_pro(image_path: str, query: str, image_size: Tuple[int, int]) -> List[Tuple[int, int, int, int]]:
    """Escalates to Gemini 2.5 Pro for precise bounding box detection when Flash is ambiguous."""
    init_services()
    print(f"\n[Pro Layer] Escalating to Gemini 2.5 Pro to pinpoint '{query}'... (Warning: Strict limits apply)")
    image = Image.open(image_path)
    width, height = image_size
    
    prompt = f"""Locate the exact bounding box for the UI element requested: "{query}".
Respond ONLY with a valid JSON array containing the bounding box coordinates scaled from 0 to 1000 (integers) in this exact format:
[ymin, xmin, ymax, xmax]
If the element cannot be found, respond with an empty array: []
Do not include markdown code block backticks."""

    try:
        response = _gemini_client.models.generate_content(
            model='gemini-2.5-pro',
            contents=[image, prompt]
        )
        
        clean_text = response.text.strip()
        if clean_text.startswith("```json"): clean_text = clean_text[7:]
        elif clean_text.startswith("```"): clean_text = clean_text[3:]
        if clean_text.endswith("```"): clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
            
        box_norm = json.loads(clean_text)
        if not box_norm or len(box_norm) < 4:
            print("[Pro Layer] Element not found by Pro either.")
            return []
            
        ymin, xmin, ymax, xmax = float(box_norm[0])/1000.0, float(box_norm[1])/1000.0, float(box_norm[2])/1000.0, float(box_norm[3])/1000.0
        
        # Convert to pixels
        y1, x1 = int(ymin * height), int(xmin * width)
        y2, x2 = int(ymax * height), int(xmax * width)
        
        print(f"[Pro Layer] Found pinpoint box: ({x1}, {y1}) to ({x2}, {y2})")
        return [(x1, y1, x2, y2)]
    except Exception as e:
        print(f"[Pro Layer] Escalation failed or failed to parse: {e}")
        try:
             print(f"Raw Output: {response.text}")
        except:
             pass
        return []

def deduplicate_boxes(boxes: List[Tuple[int, int, int, int]], threshold: int = 15) -> List[Tuple[int, int, int, int]]:
    """Remove overlapping or very near duplicate boxes."""
    unique_boxes = []
    for box in boxes:
        x1, y1, x2, y2 = box
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        is_duplicate = False
        
        for e_box in unique_boxes:
            ex1, ey1, ex2, ey2 = e_box
            ecx, ecy = (ex1 + ex2) / 2, (ey1 + ey2) / 2
            
            # Distance between centers
            dist = np.sqrt((cx - ecx)**2 + (cy - ecy)**2)
            if dist < threshold:
                is_duplicate = True
                break
                
        if not is_duplicate:
            unique_boxes.append(box)
            
    return unique_boxes

def snap_to_nearest_box(target_box: Tuple[int, int, int, int], candidate_boxes: List[Tuple[int, int, int, int]]) -> List[Tuple[int, int, int, int]]:
    """
    Finds the candidate box (e.g. from OpenCV or OCR) whose center is closest 
    to the target_box's center (e.g. from Gemini Pro's rough estimation).
    """
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
            
    # As long as it's reasonably close (e.g. within 150 pixels), snap to it
    if min_dist < 150:
        print(f"[Snap] Snapped Gemini's rough box to actual element. Offset corrected by {min_dist:.1f}px")
        return [closest_box]
        
    return [target_box]

def box_scaled_to_pixels(box_norm: List[float], image_size: Tuple[int, int]) -> Tuple[int, int, int, int]:
    """Convert [ymin, xmin, ymax, xmax] 0-1000 scale to pixel coordinates."""
    if not box_norm or len(box_norm) < 4:
        return None
    width, height = image_size
    ymin, xmin, ymax, xmax = float(box_norm[0])/1000.0, float(box_norm[1])/1000.0, float(box_norm[2])/1000.0, float(box_norm[3])/1000.0
    return (int(xmin * width), int(ymin * height), int(xmax * width), int(ymax * height))

def find_element_unified(image_path: str, query: str) -> Tuple[List[Tuple[int, int, int, int]], float]:
    """
    Main pipeline stringing together Gemini, OCR, and CV.
    """
    start_time = time.time()
    print(f"\n[UNIFIED PIPELINE] Searching for: '{query}'")
    
    # 1. Analyze with Gemini
    ai_analysis = analyze_intent_and_image(image_path, query)
    target_type = ai_analysis.get('target_type', 'TEXT')
    search_terms = ai_analysis.get('search_terms', [query])
    
    # Apply hardcoded query expansions as an extra safety net for icons
    query_lower = query.lower()
    fallback_expansions = {
        'settings': ['gear icon', 'cogwheel', 'cog icon', 'preferences icon'],
        'account': ['user icon', 'profile icon', 'person icon', 'avatar'],
        'home': ['house icon', 'home icon', 'building'],
        'search': ['magnifying glass', 'search icon', 'lens icon'],
        'menu': ['hamburger menu', 'three lines', 'navigation icon', 'menu bars'],
        'close': ['x icon', 'close icon', 'cancel icon', 'cross icon'],
        'delete': ['trash icon', 'bin icon', 'garbage icon', 'delete icon']
    }
    for key, synonyms in fallback_expansions.items():
        if key in query_lower:
            search_terms.extend(synonyms)
            
    location_hint = ai_analysis.get('location', '')
    image_size = ai_analysis.get('image_size', (0,0))
    
    boxes = []
    all_candidate_boxes = [] # Cache to avoid re-running during Pro snap
    
    # 2. Routing Logic
    if target_type == 'TEXT':
        all_candidate_boxes = find_text_with_ocr(image_path, query, search_terms)
        boxes = all_candidate_boxes
        
        # Fallback to CV if OCR missed it (maybe it's a graphical text/logo)
        if not boxes:
            print("\n[Fallback] OCR found nothing. Target might be an icon. Trying CV...")
            all_candidate_boxes = find_icons_with_cv(image_path)
            boxes = filter_by_spatial_hint(all_candidate_boxes, location_hint, image_size)
            # If we had to fall back to generic CV blobs for a purely TEXT query,
            # we should still involve Pro just to be safe it's not a hallucinated blob.
            if boxes:
                print("[Escalation trigger] Text search fell back to CV blobs. Forcing Pro verification...")
                boxes = [] # Wipe to force `len != 1` Pro escalation
        else:
            if len(boxes) > 1:
                boxes = filter_by_spatial_hint(boxes, location_hint, image_size)
                
    else: # ICON
        all_candidate_boxes = find_icons_with_cv(image_path)
        boxes = filter_by_spatial_hint(all_candidate_boxes, location_hint, image_size)
        
        # Fallback to OCR if CV failed (maybe it's a text-based icon or emoji)
        if not boxes:
            print("\n[Fallback] CV/Snap found nothing matching. Target might be text-labeled. Trying OCR...")
            all_candidate_boxes = find_text_with_ocr(image_path, query, search_terms)
            boxes = all_candidate_boxes
            if len(boxes) > 1:
                boxes = filter_by_spatial_hint(boxes, location_hint, image_size)

    # 3. Clean up
    final_boxes = deduplicate_boxes(boxes)
    
    # 4. Escalation Pattern (Fallback to Gemini 2.5 Pro if ambiguous or not found)
    if len(final_boxes) != 1:
        print(f"\n[Escalation] Fallback layers returned {len(final_boxes)} results. Escalating to Gemini 2.5 Pro for precision...")
        pro_boxes = escalate_to_pro(image_path, query, image_size)
        
        # Give preference to Pro if it successfully finds something
        if pro_boxes:
            # Snap the slightly-inaccurate Pro box to the nearest perfectly-drawn OpenCV/OCR box
            snapped_boxes = snap_to_nearest_box(pro_boxes[0], all_candidate_boxes)
            final_boxes = deduplicate_boxes(snapped_boxes)
        else:
            print("[Escalation] Pro couldn't isolate it. Falling back to previous results.")

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

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python unified_pipeline_test.py <image_path> <query> [output_path]")
        print("\nUnified Pipeline uses: Gemini 2.5 Flash + EasyOCR + OpenCV")
        print("\nExamples:")
        print("  python unified_pipeline_test.py input-images/input-icons.png \"gear icon\"")
        print("  python unified_pipeline_test.py input-images/input-wikipedia.png \"Log in to your account\"")
        sys.exit(1)
        
    image_path = sys.argv[1]
    query = sys.argv[2]
    
    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    else:
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        if base_name.startswith("input-"):
            base_name = base_name[6:]
        output_path = f"output-images/output-{base_name}.png"
        
    # Ensure directories exist
    os.makedirs("output-images", exist_ok=True)
        
    process_image(image_path, query, output_path)
