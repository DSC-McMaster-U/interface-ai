import os
import sys

# Add the parent directory to sys.path to import the pipeline and common_utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import find_element_unified

def test_dummy():
    # Placeholder so pytest doesn't fail with empty tests if there are no other tests
    pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_vision.py <image_path> <query> [output_path]")
        print("\nUnified Pipeline uses: Gemini 2.5 Flash + EasyOCR + OpenCV")
        print("\nExamples:")
        print('  python test_vision.py input-images/input-icons.png "gear icon"')
        print(
            '  python test_vision.py input-images/input-wikipedia.png "Log in to your account"'
        )
        sys.exit(1)

    image_path = sys.argv[1]
    query = sys.argv[2]

    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    else:
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        if base_name.startswith("input-"):
            base_name = base_name[6:]
        test_dir = os.path.dirname(os.path.abspath(__file__))
        output_path = os.path.join(test_dir, "output-images", f"output-{base_name}.png")

    # Ensure directory exists for the output path
    output_dir = os.path.dirname(os.path.abspath(output_path))
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    find_element_unified(image_path, query, output_path)
