import os
import sys

# Add the parent directory to sys.path to import the pipeline and common_utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import process_image

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_vision.py <image_path> <query> [output_path]")
        print("\nUnified Pipeline uses: Gemini 2.5 Flash + EasyOCR + OpenCV")
        print("\nExamples:")
        print("  python test_vision.py input-images/input-icons.png \"gear icon\"")
        print("  python test_vision.py input-images/input-wikipedia.png \"Log in to your account\"")
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
