# Vision AI Tests (CMD Only)

This directory contains standalone tests for the Vision AI pipeline. These tools can identify both textual and icon-based UI elements in screenshots, utilizing Gemini 2.5 Flash as an intelligent router and fallback, alongside EasyOCR and OpenCV.

## Setup

1. Make sure you are in the `vision-ai` container directory or have the necessary dependencies installed:
   ```bash
   pip install -r ../requirements.txt
   ```
2. Copy the `.env.example` in the `vision-ai` folder to `.env` and insert your Gemini API Key:
   ```bash
   GEMINI_API_KEY="your-api-key"
   ```

## Running the Tests

You can test the unified vision pipeline through the command line via `test_vision.py`.

**Usage:**

```bash
python test_vision.py <image_path> <query> [output_path]
```

**Examples:**

```bash
# Testing an icon detection (Uses OpenCV + Gemini Spatial constraints)
python test_vision.py tests/input-images/input-icons.png "gear icon"

# Testing text detection (Uses EasyOCR + Gemini Spatial constraints)
python test_vision.py tests/input-images/input-wikipedia.png "Log in to your account"
```

The output file (with bounding boxes drawn) will default to `output-images/output-<filename>.png` in the directory you run it from, but you can optionally override this by specifying the final `[output_path]` argument.
