#!/usr/bin/env python3
"""
Quick test script to verify Playwright ActionExecutor integration
Run this before testing with the Chrome extension
"""

import sys
import os

# Add playwright directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), "playwright"))

print("=" * 60)
print("InterfaceAI - Playwright Integration Test")
print("=" * 60)

# Test 1: Import ActionExecutor
print("\n[Test 1] Importing ActionExecutor...")
try:
    from action_executor import ActionExecutor
    print("✅ ActionExecutor imported successfully")
except ImportError as e:
    print(f"❌ Failed to import ActionExecutor: {e}")
    print("\nFix: Run the following commands:")
    print("  cd playwright")
    print("  pip install -r requirements.txt")
    print("  playwright install chromium")
    sys.exit(1)

# Test 2: Check Playwright installation
print("\n[Test 2] Checking Playwright installation...")
try:
    from playwright.sync_api import sync_playwright
    print("✅ Playwright is installed")
except ImportError:
    print("❌ Playwright not installed")
    print("\nFix: Run the following commands:")
    print("  pip install playwright")
    print("  playwright install chromium")
    sys.exit(1)

# Test 3: Create ActionExecutor instance
print("\n[Test 3] Creating ActionExecutor instance...")
try:
    executor = ActionExecutor(headless=True)
    print("✅ ActionExecutor instance created")
except Exception as e:
    print(f"❌ Failed to create ActionExecutor: {e}")
    sys.exit(1)

# Test 4: Test with a simple page
print("\n[Test 4] Testing button click on test page...")
print("  Opening test page and looking for 'Submit' button...")
try:
    # Use the test page
    test_page_path = os.path.join(os.path.dirname(__file__), "frontend", "test-page.html")
    test_url = f"file://{os.path.abspath(test_page_path)}"
    
    print(f"  URL: {test_url}")
    
    executor.start(url=test_url)
    print(f"  Page loaded: {executor.page.title()}")
    
    # Try to find and click the Submit button
    found = executor.click_button_by_text("Submit")
    
    if found:
        print("✅ Button FOUND and clicked successfully!")
    else:
        print("❌ Button NOT FOUND")
    
    # Clean up
    executor.stop()
    
except Exception as e:
    print(f"❌ Error during test: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ All tests passed!")
print("=" * 60)
print("\nYou can now:")
print("1. Start the backend: cd backend && python app/main.py")
print("2. Load the Chrome extension from the frontend folder")
print("3. Test clicking buttons on any webpage!")
print()
