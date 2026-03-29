# Vision AI Tests (CLI Only)

This directory contains standalone tests for the Vision AI pipeline. These tools can identify both textual and icon-based UI elements in screenshots, utilizing Gemini 2.5 Flash as an intelligent router and fallback, alongside EasyOCR and OpenCV.

## Setup

1. Make sure you are in the `vision-ai` container directory or have the necessary dependencies installed:
   ```bash
   pip install -r ../requirements.txt
   ```
2. Create a `.env` file in the `vision-ai` folder with your Gemini API key. Example contents (no surrounding quotes):
   ```text
   GEMINI_API_KEY=your-api-key
   ```

   Quick commands:- Unix / macOS (from `vision-ai`):
     ```bash
     cp .env.example .env
     # or
     echo 'GEMINI_API_KEY=your-api-key' > .env
     ```
   - Windows PowerShell (from `vision-ai`):
     ```powershell
     Copy-Item .env.example .env
     Set-Content -Path .env -Value 'GEMINI_API_KEY=your-api-key'
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
python test_vision.py tests/input-images/input-wikipedia.png "log in"
```

The output file (with bounding boxes drawn) will default to the `output-images/` folder inside this `tests` directory (`vision-ai/tests/output-images/output-<filename>.png`), but you can optionally override this by specifying the final `[output_path]` argument.
