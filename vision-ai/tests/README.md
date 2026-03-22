# Vision AI Test Scripts

This directory contains different approaches to locating UI elements in images:

1. **EasyOCR Text Detection** (`easyocr_test.py`) - Finds exact text matches using OCR
2. **Gemini + EasyOCR** (`easyocr_gemini_test.py`) - Uses AI to generate related words, then searches for all variants
3. **Grounding DINO** (`groundingdino_test.py`) - Zero-shot object detection that can find visual elements by description
4. **Gemini Vision** (`gemini_vision_test.py`) - Uses Gemini's multimodal vision AI to detect and locate any UI element with semantic understanding
5. **Gemini Hybrid** (`gemini_hybrid_test.py`) - Combines Gemini's semantic understanding with CV for precise icon detection
6. **Unified Pipeline** (`unified_pipeline_test.py`) - **RECOMMENDED PRODUCTION STACK** - Intelligent routing between Text (OCR) and Icons (CV) driven by Gemini 2.5 Flash's spatial hints.

## Install Dependencies

```powershell
python -m pip install easyocr opencv-python pillow numpy torch torchvision transformers timm google-genai python-dotenv
```

## Set Gemini API Key (for Scripts 2 & 4)

1. Copy the example environment file:

```powershell
cp .env.example .env
```

2. Edit `.env` and add your API key:

```
GEMINI_API_KEY=your-actual-api-key-here
```

Get your free API key from: https://aistudio.google.com/app/apikey

**Free Tier Limits:**

- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per day

## Run Scripts

### Script 1: EasyOCR Text Detection

```powershell
python easyocr_test.py input-images/input-youtube.png "text"
```

Output will be saved to: `output-images/output-youtube.png`

### Script 2: Gemini + EasyOCR (searches for related words)

```powershell
python easyocr_gemini_test.py input-images/input-youtube.png "text"
```

Output will be saved to: `output-images/output-youtube.png`

### Script 3: Grounding DINO Object Detection

Grounding DINO works best with simple noun phrases describing the object/icon you want to find.

**Good prompts:**

- `icon` - finds all icons
- `home icon`
- `button`
- `settings icon`
- `search icon`

**Avoid action words** like "go", "click", "press" - they confuse the model.

```powershell
python groundingdino_test.py input-images/input-icons.png "icon"
```

You can also specify confidence threshold (default 0.25):

```powershell
python groundingdino_test.py input-images/input-icons.png "home icon" output.png 0.2
```

The script will:

1. Show all detections at low confidence (for debugging)
2. Filter out boxes that are too large (entire image) or too small
3. Show final detections above your threshold

Output will be saved to: `output-images/output-icons.png`

**Note:** Output filenames are automatically generated as `output-<input-name>.png` in the `output-images/` folder.

### Script 4: Gemini Vision AI Detection

Gemini Vision uses Google's multimodal AI to understand images semantically. Unlike Grounding DINO, it can distinguish between different types of icons and understand context.

**Advantages:**

- Semantic understanding (can tell home icon from settings icon)
- Natural language queries
- Contextual awareness (e.g., "the red button in top-right corner")
- Works with complex descriptions

**Examples:**

```powershell
# Find specific icon types
python gemini_vision_test.py input-images/input-icons.png "home icon"

# Find UI elements by description
python gemini_vision_test.py input-images/input-youtube.png "subscribe button"

# Find multiple elements
python gemini_vision_test.py input-images/input-youtube.png "video thumbnails"

# With custom output path
python gemini_vision_test.py input-images/input-youtube.png "search bar" output.png
```

**Prompting tips:**

- Be specific: "red subscribe button" instead of just "button"
- Use context: "navigation menu at the top"
- Describe visually: "circular profile icon"
- For multiple: "all social media icons"

Output will be saved to: `output-images/output-<input-name>.png`

**Note:** Uses the free `gemini-2.5-flash` model. API key required (see above).
**⚠️ Known Limitations:**

- Vision LLMs like Gemini can struggle with **precise pixel-level bounding boxes** for small icons
- Better for larger UI elements (buttons, cards, sections) than tiny icons (< 30px)
- May return approximate rather than pixel-perfect coordinates
- For precise icon detection, use Script 5 (Hybrid) below

### Script 5: Gemini Hybrid Detection

Combines Gemini's semantic understanding with computer vision for precise detection. Best of both worlds!

**How it works:**

1. **Query Expansion**: Automatically expands your search (e.g., "settings" → "gear icon", "cogwheel", "cog icon")
2. **Semantic Understanding**: Gemini analyzes the image and describes what it sees and where
3. **Precise Detection**: OpenCV detects all icon-like objects with pixel-perfect coordinates
4. **Smart Filtering**: Results are filtered based on Gemini's semantic understanding

**Examples:**

```powershell
# Search by concept - automatically expands to visual descriptions
python gemini_hybrid_test.py input-images/input-icons.png "settings"
# → Searches for: gear icon, cogwheel, cog icon, preferences icon, etc.

python gemini_hybrid_test.py input-images/input-icons.png "account"
# → Searches for: user icon, profile icon, person icon, avatar, etc.

# Direct icon names also work
python gemini_hybrid_test.py input-images/input-icons.png "gear icon"

# Natural language queries
python gemini_hybrid_test.py input-images/input-icons.png "home"
```

**Built-in Query Expansions:**

- settings → gear icon, cogwheel, cog icon, preferences
- account → user icon, profile icon, avatar
- home → house icon, building
- search → magnifying glass, lens icon
- menu → hamburger menu, three lines
- And 15+ more common UI elements!

### Script 6: Unified Pipeline (Gemini 2.5 Flash + EasyOCR + OpenCV)

It dynamically routes your query to the correct tool based on whether you are looking for a text element or a visual icon, acting as the ultimate fallback for your automation graph.

**How it works:**

1. **Intelligent Routing**: Gemini 2.5 Flash looks at the image + query and decides if it is a `TEXT` target or an `ICON` target. It extracts search synonyms and spatial hints (e.g., "top-right" or "row 5").
2. **Text Layer (EasyOCR)**: If the target is categorized as text, it runs EasyOCR and fuzzy matches the text variations against the screenshot.
3. **Computer Vision Layer (OpenCV)**: If it's a visual element, it triggers OpenCV's contour blob detector to locate icons.
4. **Spatial Filter**: It applies the spatial hint from step 1 to filter down multiple visual/text candidates across the screen to the precise single target you meant.

**Examples:**

```powershell
# Search for an icon (Routes to OpenCV)
python unified_pipeline_test.py input-images/input-icons.png "gear icon"

# Search for a text button/link (Routes to EasyOCR)
python unified_pipeline_test.py input-images/input-wikipedia.png "Create account"
```

Output will be saved to: `output-images/output-<input-name>.png`
