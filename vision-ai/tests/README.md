# Install Dependencies

```powershell
python -m pip install easyocr opencv-python pillow numpy torch torchvision transformers google-generativeai python-dotenv
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

**Note:** Output filenames are automatically generated as `output-<input-name>.png` in the `output-images/` folder.
