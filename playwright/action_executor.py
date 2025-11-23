"""
Action Executor: Playwright-based Web Automation
=================================================

Description:
Based on the name of a button (like "submit"), it should click on the button
if it exists on the current page. Uses Playwright functions for automation.

Integrates with Google Search capabilities - after initial search, this script
takes over to perform actions on the page.

Motivation: To do basic clicks in the UI

Author: Adrian Najmi
Date: 2025/11/23
"""

from playwright.sync_api import sync_playwright, Page, Browser
import sys
import argparse
import time
from typing import Optional, List, Tuple


class ActionExecutor:
    """Executes actions on web pages using Playwright"""
    
    def __init__(self, headless: bool = False):
        """
        Initialize the Action Executor
        
        Args:
            headless: Whether to run browser in headless mode
        """
        self.headless = headless
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        
    def start(self, url: str = None):
        """Start Playwright and navigate to URL if provided.
    If URL not provided, assumes we're working with existing search results.
        Args:
            url: Optional URL to navigate to on start
    """
        
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
          
        if url:
            self.page = self.browser.new_page()
            print(f" Navigating to: {url}")
            self.page.goto(url)
            self.page.wait_for_load_state('networkidle')
            print(f" Loaded: {self.page.title()}")
        else:
            # Create new page on current state
            self.page = self.browser.new_page()
            print(" Browser ready - waiting for actions")
        
    def stop(self):
        """Stop the Playwright browser"""
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
        print(" Browser stopped")

    def connect_to_current_page(self, url: str):
        """
        Connect to an existing page (used after external search)
    
        Args:
            url: URL of the current page (from search results)
        """
        if not self.page:
            self.start()
    
        print(f" Connecting to current page: {url}")
        self.page.goto(url)
        self.page.wait_for_load_state('networkidle')
        print(f" Connected: {self.page.title()}")
        
    def navigate_to(self, url: str):
        """
        Navigate to a URL
        
        Args:
            url: The URL to navigate to
        """
        print(f" Navigating to: {url}")
        self.page.goto(url)
        self.page.wait_for_load_state('networkidle')
        print(f" Loaded: {self.page.title()}")
    
        
    def click_button_by_text(self, button_text: str) -> bool:
        """
        Click a button based on its text content
        
        This is the main function that implements the requirement:
        "Based on the name of a button like 'submit', it should click on the button
        (assuming a button exists in the html with the test = 'submit') if its on 
        the current page"
        
        Args:
            button_text: The text to search for in buttons (case-insensitive)
            
        Returns:
            bool: True if button was found and clicked, False otherwise
        """
        print(f"\n Looking for button with text: '{button_text}'")
        
        # Try multiple selectors to find the button
        selectors = [
            f"button:has-text('{button_text}')",
            f"input[type='submit']:has-text('{button_text}')",
            f"input[type='button']:has-text('{button_text}')",
            f"a:has-text('{button_text}')",
            f"[role='button']:has-text('{button_text}')",
            # Case-insensitive versions
            f"button >> text=/{button_text}/i",
            f"input[type='submit'] >> text=/{button_text}/i",
            f"input[type='button'] >> text=/{button_text}/i",
        ]
        
        for selector in selectors:
            try:
                # Check if element exists and is visible
                if self.page.locator(selector).count() > 0:
                    element = self.page.locator(selector).first
                    
                    # Wait for element to be visible and enabled
                    element.wait_for(state='visible', timeout=2000)
                    
                    # Get element info before clicking
                    text = element.inner_text()
                    tag = element.evaluate("el => el.tagName")
                    
                    print(f" Found button: <{tag}> with text '{text}'")
                    print(f"  Using selector: {selector}")
                    
                    # Click the button
                    element.click()
                    print(f" Clicked button successfully!")
                    
                    # Wait a moment for any navigation/actions to complete
                    time.sleep(0.5)
                    
                    return True
                    
            except Exception as e:
                # Try next selector
                continue
        
        print(f" Button with text '{button_text}' not found on current page")
        return False
    
    def click_button_by_exact_match(self, button_text: str) -> bool:
        """
        Click a button by exact text match (more strict)
        
        Args:
            button_text: The exact text of the button
            
        Returns:
            bool: True if clicked, False otherwise
        """
        print(f"\n Looking for button with exact text: '{button_text}'")
        
        try:
            # Use XPath for exact text match
            xpath = f"//button[text()='{button_text}'] | //input[@type='submit' and @value='{button_text}'] | //input[@type='button' and @value='{button_text}']"
            
            if self.page.locator(f"xpath={xpath}").count() > 0:
                element = self.page.locator(f"xpath={xpath}").first
                element.wait_for(state='visible', timeout=2000)
                element.click()
                print(f" Clicked button with exact text '{button_text}'")
                return True
                
        except Exception as e:
            print(f" Error: {e}")
            
        print(f" Button with exact text '{button_text}' not found")
        return False
    
    def list_all_buttons(self) -> List[Tuple[str, str]]:
        """
        List all buttons on the current page
        
        Returns:
            List of tuples (button_text, button_type)
        """
        print("\n Listing all buttons on current page:")
        
        buttons = []
        
        # Find all button elements
        for selector in ['button', 'input[type="submit"]', 'input[type="button"]', '[role="button"]', 'a.button', 'a.btn']:
            try:
                elements = self.page.locator(selector).all()
                for elem in elements:
                    try:
                        if elem.is_visible():
                            text = elem.inner_text() or elem.get_attribute('value') or elem.get_attribute('aria-label') or ''
                            tag = elem.evaluate("el => el.tagName")
                            if text:
                                buttons.append((text.strip(), tag))
                    except:
                        continue
            except:
                continue
        
        # Print results
        if buttons:
            for i, (text, tag) in enumerate(buttons, 1):
                print(f"  {i}. [{tag}] {text}")
        else:
            print("  No buttons found on page")
            
        return buttons
    
    def fill_input_field(self, field_name: str, value: str) -> bool:
        """
        Fill an input field by its name, placeholder, or label
        
        Args:
            field_name: Name/placeholder/label of the field
            value: Value to fill
            
        Returns:
            bool: True if successful, False otherwise
        """
        print(f"\n Filling field '{field_name}' with: {value}")
        
        selectors = [
            f"input[name='{field_name}']",
            f"input[placeholder*='{field_name}' i]",
            f"textarea[name='{field_name}']",
            f"textarea[placeholder*='{field_name}' i]",
            f"input >> text=/{field_name}/i",
        ]
        
        for selector in selectors:
            try:
                if self.page.locator(selector).count() > 0:
                    element = self.page.locator(selector).first
                    element.wait_for(state='visible', timeout=2000)
                    element.fill(value)
                    print(f" Filled field successfully")
                    return True
            except:
                continue
                
        print(f" Field '{field_name}' not found")
        return False
    
        
    def get_page_info(self):
        """Print current page information"""
        print(f"\n Current Page Info:")
        print(f"  URL: {self.page.url}")
        print(f"  Title: {self.page.title()}")


def main():
    """Main function - demonstrates usage"""
    
    parser = argparse.ArgumentParser(
        description='Action Executor: Playwright-based web automation',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
USAGE:
# After external search, click a button on current page
  python action_executor.py --url "https://current-page-url.com" --click "Submit"

  # Navigate to a URL and click a button
  python action_executor.py --url "https://example.com" --click "submit"
  
  # List all buttons on a page
  python action_executor.py --url "https://example.com" --list-buttons
  
  # Fill a form and submit
  python action_executor.py --url "https://example.com" --fill "email" "test@test.com" --click "Submit"

  Note: This script integrates with EXISTING Google Search capabilities.
      Perform search externally first (e.g., via Interface AI extension),
      then provide the current page URL to this script.
        """
    )
    
    parser.add_argument('--url', type=str, required=True, help='Current page url from search results')
    parser.add_argument('--click', type=str, help='Button text to click')
    parser.add_argument('--click-exact', type=str, help='Button text to click (exact match)')
    parser.add_argument('--fill', nargs=2, metavar=('FIELD', 'VALUE'), help='Fill input field')
    parser.add_argument('--list-buttons', action='store_true', help='List all buttons on page')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    parser.add_argument('--wait', type=int, default=2, help='Seconds to wait before closing (default: 2)')
    
    args = parser.parse_args()
    
    # Create executor
    executor = ActionExecutor(headless=args.headless)
    
    try:
        # Start browser
        executor.start(url=args.url)
        
        # Show page info
        executor.get_page_info()
        
        # List buttons if requested
        if args.list_buttons:
            executor.list_all_buttons()
        
        # Fill form field if requested
        if args.fill:
            field_name, value = args.fill
            executor.fill_input_field(field_name, value)
        
        # Click button if requested
        if args.click:
            executor.click_button_by_text(args.click)
        elif args.click_exact:
            executor.click_button_by_exact_match(args.click_exact)
        
        # Wait before closing
        if not args.headless and args.wait > 0:
            print(f"\n Waiting {args.wait} seconds before closing...")
            time.sleep(args.wait)
        
        # Show final page info
        executor.get_page_info()
        
    except KeyboardInterrupt:
        print("\n\n  Interrupted by user")
    except Exception as e:
        print(f"\n Error: {e}")
        return 1
    finally:
        executor.stop()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())