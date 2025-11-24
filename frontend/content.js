/**
 * Content Script: Runs on user's webpages
 * Handles button clicking based on text received from popup/background
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Content Script] Received message:", request.action);

  if (request.action === "scrapeElements") {
    console.log("[Content Script] Scraping page elements...");
    const elements = scrapePageElements();
    console.log("[Content Script] Found elements:", elements);
    sendResponse({ success: true, elements });
    return true;
  }

  if (request.action === "scrapeFullPage") {
    console.log("[Content Script] Scraping full page content...");
    const content = scrapeFullPageContent();
    console.log("[Content Script] Scraped content:", content);
    sendResponse({ success: true, content });
    return true;
  }

  if (request.action === "clickButton") {
    const buttonText = request.buttonText;
    console.log(`[InterfaceAI] Attempting to click button: "${buttonText}"`);
    const result = clickButtonByText(buttonText);
    sendResponse(result);
  } else if (request.action === "fillTextbox") {
    const { fieldName, textToFill } = request;
    console.log(
      `[InterfaceAI] Attempting to fill textbox: "${fieldName}" with "${textToFill}"`
    );
    const result = fillTextboxByName(fieldName, textToFill);
    sendResponse(result);
  } else if (request.action === "clickFirstSearchResult") {
    console.log("[InterfaceAI] Attempting to click first Google search result");
    const result = clickFirstGoogleResult();
    sendResponse(result);
  }

  return true; // Keep message channel open for async response
});

/**
 * Click a button or link based on its text content
 * Supports buttons, links (<a> tags), and other clickable elements
 * Implements similar logic to action_executor.py's click_button_by_text
 */
function clickButtonByText(buttonText) {
  // Try multiple selectors to find clickable elements
  const selectors = [
    // Buttons, links, and clickable elements
    `button:contains("${buttonText}")`,
    `input[type="submit"][value*="${buttonText}" i]`,
    `input[type="button"][value*="${buttonText}" i]`,
    `a:contains("${buttonText}")`,
    `[role="button"]:contains("${buttonText}")`,
    // Also check aria-label
    `button[aria-label*="${buttonText}" i]`,
    `a[aria-label*="${buttonText}" i]`,
    `[role="button"][aria-label*="${buttonText}" i]`,
  ];

  // Custom contains selector (case-insensitive)
  function findByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    for (let elem of elements) {
      const elementText =
        elem.textContent ||
        elem.value ||
        elem.getAttribute("aria-label") ||
        "";
      if (elementText.toLowerCase().includes(text.toLowerCase())) {
        return elem;
      }
    }
    return null;
  }

  // Try to find the clickable element (button or link)
  let clickableElement = null;
  const lowerText = buttonText.toLowerCase();

  // Try direct querySelector - includes all <a> tags (links are clickable!)
  const allClickables = document.querySelectorAll(
    'button, input[type="submit"], input[type="button"], a, [role="button"], [onclick]'
  );

  for (let elem of allClickables) {
    const elemText =
      elem.textContent || elem.value || elem.getAttribute("aria-label") || "";

    if (elemText.toLowerCase().includes(lowerText)) {
      // Check if element is visible
      const rect = elem.getBoundingClientRect();
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        window.getComputedStyle(elem).display !== "none" &&
        window.getComputedStyle(elem).visibility !== "hidden";

      if (isVisible) {
        clickableElement = elem;
        break;
      }
    }
  }

  if (clickableElement) {
    try {
      // Scroll into view
      clickableElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight the element briefly
      const originalBorder = clickableElement.style.border;
      clickableElement.style.border = "3px solid #4CAF50";
      setTimeout(() => {
        clickableElement.style.border = originalBorder;
      }, 1000);

      // Click the element (button or link)
      clickableElement.click();

      const elementType = clickableElement.tagName.toLowerCase() === 'a' ? 'link' : 'button';
      console.log(`[InterfaceAI] Successfully clicked ${elementType}: "${buttonText}"`);
      return {
        success: true,
        message: `Clicked ${elementType}: "${buttonText}"`,
        elementTag: clickableElement.tagName,
        elementText: clickableElement.textContent || clickableElement.value,
      };
    } catch (error) {
      console.error("[InterfaceAI] Error clicking element:", error);
      return {
        success: false,
        message: `Error clicking element: ${error.message}`,
      };
    }
  } else {
    console.warn(`[InterfaceAI] Clickable element not found: "${buttonText}"`);
    return {
      success: false,
      message: `Clickable element with text "${buttonText}" not found on page`,
    };
  }
}

/**
 * Fill a textbox based on its name, placeholder, or label
 */
function fillTextboxByName(fieldName, textToFill) {
  console.log(`[InterfaceAI] Searching for textbox: "${fieldName}"`);

  // Try multiple selectors
  const selectors = [
    `input[name="${fieldName}"]`,
    `input[placeholder*="${fieldName}" i]`,
    `textarea[name="${fieldName}"]`,
    `textarea[placeholder*="${fieldName}" i]`,
    `input[id*="${fieldName}" i]`,
    `textarea[id*="${fieldName}" i]`,
  ];

  // Also try finding by label
  const labels = document.querySelectorAll("label");
  let labeledInput = null;

  for (let label of labels) {
    if (label.textContent.toLowerCase().includes(fieldName.toLowerCase())) {
      const forAttr = label.getAttribute("for");
      if (forAttr) {
        labeledInput = document.getElementById(forAttr);
        break;
      }
      // Check for input inside label
      const input = label.querySelector("input, textarea");
      if (input) {
        labeledInput = input;
        break;
      }
    }
  }

  let inputElement = labeledInput;

  // Try selectors if label search didn't work
  if (!inputElement) {
    for (let selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (let elem of elements) {
          const rect = elem.getBoundingClientRect();
          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(elem).display !== "none" &&
            window.getComputedStyle(elem).visibility !== "hidden";

          if (isVisible) {
            inputElement = elem;
            break;
          }
        }
        if (inputElement) break;
      } catch (e) {
        continue;
      }
    }
  }

  if (inputElement) {
    try {
      // Scroll into view
      inputElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight the field briefly
      const originalBorder = inputElement.style.border;
      inputElement.style.border = "3px solid #2196F3";

      // Fill the field
      inputElement.value = textToFill;
      inputElement.focus();

      // Trigger input events
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));

      setTimeout(() => {
        inputElement.style.border = originalBorder;
      }, 1000);

      console.log(`[InterfaceAI] Successfully filled textbox: "${fieldName}"`);
      return {
        success: true,
        message: `Filled "${fieldName}" with "${textToFill}"`,
        fieldName: fieldName,
        value: textToFill,
      };
    } catch (error) {
      console.error("[InterfaceAI] Error filling textbox:", error);
      return {
        success: false,
        message: `Error filling textbox: ${error.message}`,
      };
    }
  } else {
    console.warn(`[InterfaceAI] Textbox not found: "${fieldName}"`);
    return {
      success: false,
      message: `Textbox "${fieldName}" not found on page`,
    };
  }
}

/**
 * Click the first Google search result
 */
function clickFirstGoogleResult() {
  console.log("[InterfaceAI] Searching for first Google result...");

  // Google search result selectors
  const selectors = [
    'a[href]:has(h3)', // Standard result link with h3
    'div.g a[href]', // Result in g container
    '#search a[href]:not([href^="#"])', // Links in search container
  ];

  for (let selector of selectors) {
    try {
      const links = document.querySelectorAll(selector);
      for (let link of links) {
        const href = link.getAttribute("href");

        // Skip Google internal links and ads
        if (
          href &&
          !href.includes("google.com") &&
          !href.includes("youtube.com") &&
          !href.startsWith("#") &&
          !link.closest('[data-text-ad]') &&
          !link.closest('.commercial-unit-desktop-top')
        ) {
          // Check if visible
          const rect = link.getBoundingClientRect();
          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(link).display !== "none";

          if (isVisible) {
            // Highlight briefly
            const originalBorder = link.style.border;
            link.style.border = "3px solid #FF9800";

            setTimeout(() => {
              link.style.border = originalBorder;
            }, 500);

            // Click the link
            link.click();

            console.log(`[InterfaceAI] Clicked first result: ${href}`);
            return {
              success: true,
              message: `Clicked first search result`,
              url: href,
            };
          }
        }
      }
    } catch (e) {
      continue;
    }
  }

  console.warn("[InterfaceAI] First search result not found");
  return {
    success: false,
    message: "Could not find first search result",
  };
}

console.log("[InterfaceAI] Content script loaded");

// Scrape page for available interactive elements
function scrapePageElements() {
  const elements = {
    buttons: [],
    textboxes: [],
    links: [],
  };

  // Get all clickable elements (buttons, links, clickable divs)
  const clickables = document.querySelectorAll(
    'button, input[type="button"], input[type="submit"], a, [role="button"], [onclick]'
  );
  clickables.forEach((el) => {
    const text = el.textContent?.trim() || el.value || el.getAttribute("aria-label") || "";
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute("type") || "";
    
    if (text && text.length < 100) {
      if (tag === "a") {
        elements.links.push(text);
      } else {
        elements.buttons.push(text);
      }
    }
  });

  // Get all input fields
  const inputs = document.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="password"], input[type="search"], textarea, input:not([type])'
  );
  inputs.forEach((el) => {
    const name = el.name || el.id || el.placeholder || el.getAttribute("aria-label") || "";
    if (name && name.length < 100) {
      elements.textboxes.push(name);
    }
  });

  // Limit to top 20 of each to avoid huge payloads
  return {
    buttons: [...new Set(elements.buttons)].slice(0, 20),
    textboxes: [...new Set(elements.textboxes)].slice(0, 20),
    links: [...new Set(elements.links)].slice(0, 20),
  };
}

// Scrape full page content for goal verification
function scrapeFullPageContent() {
  const content = {
    title: document.title,
    url: window.location.href,
    headings: [],
    visibleText: [],
    buttons: [],
    textboxes: [],
    links: [],
    images: [],
  };

  // Get headings
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach((h) => {
    const text = h.textContent?.trim();
    if (text && text.length < 200) {
      content.headings.push(text);
    }
  });

  // Get visible text from main content areas
  const textElements = document.querySelectorAll('p, span, div, li, td');
  const seenText = new Set();
  textElements.forEach((el) => {
    // Only get text from visible elements
    if (el.offsetParent !== null) {
      const text = el.textContent?.trim();
      if (text && text.length > 10 && text.length < 300 && !seenText.has(text)) {
        seenText.add(text);
        content.visibleText.push(text);
      }
    }
  });

  // Get interactive elements (reuse from scrapePageElements)
  const elements = scrapePageElements();
  content.buttons = elements.buttons;
  content.textboxes = elements.textboxes;
  content.links = elements.links;

  // Get visible images with alt text
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    const alt = img.alt || img.title;
    if (alt && alt.length < 100) {
      content.images.push(alt);
    }
  });

  // Limit text to top 30 items to avoid massive payloads
  content.headings = [...new Set(content.headings)].slice(0, 10);
  content.visibleText = [...new Set(content.visibleText)].slice(0, 30);
  content.images = [...new Set(content.images)].slice(0, 10);

  console.log("[Content Script] Scraped full page content:", content);
  return content;
}

console.log("[InterfaceAI] Content script loaded");
