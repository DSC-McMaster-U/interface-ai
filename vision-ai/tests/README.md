# Vision AI Test Scripts

This directory contains three different approaches to locating UI elements in images:

1. **EasyOCR Text Detection** (`easyocr_test.py`) - Finds exact text matches using OCR
2. **Gemini + EasyOCR** (`easyocr_gemini_test.py`) - Uses AI to generate related words, then searches for all variants
3. **Grounding DINO** (`groundingdino_test.py`) - Zero-shot object detection that can find visual elements by description

## Install Dependencies

```powershell
python -m pip install easyocr opencv-python pillow numpy torch torchvision transformers timm google-genai python-dotenv
```

## Set Gemini API Key (for Script 2)

1. Copy the example environment file:

```powershell
cp .env.example .env
```

2. Edit `.env` and add your API key:

```
GEMINI_API_KEY=your-actual-api-key-here
```

Get your free API key from: https://makersuite.google.com/app/apikey

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
