/**
 * Content Script: Runs on user's webpages
 * Handles button clicking based on text received from popup/background
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[InterfaceAI] Received action:", request.action);

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
 * Click a button based on its text content
 * Implements similar logic to action_executor.py's click_button_by_text
 */
function clickButtonByText(buttonText) {
  // Try multiple selectors to find the button
  const selectors = [
    // Standard button elements
    `button:contains("${buttonText}")`,
    `input[type="submit"][value*="${buttonText}" i]`,
    `input[type="button"][value*="${buttonText}" i]`,
    `a:contains("${buttonText}")`,
    `[role="button"]:contains("${buttonText}")`,
    // Also check aria-label
    `button[aria-label*="${buttonText}" i]`,
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

  // Try to find the button
  let buttonElement = null;
  const lowerText = buttonText.toLowerCase();

  // Try direct querySelector first
  const allButtons = document.querySelectorAll(
    'button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]'
  );

  for (let elem of allButtons) {
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
        buttonElement = elem;
        break;
      }
    }
  }

  if (buttonElement) {
    try {
      // Scroll into view
      buttonElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight the button briefly
      const originalBorder = buttonElement.style.border;
      buttonElement.style.border = "3px solid #4CAF50";
      setTimeout(() => {
        buttonElement.style.border = originalBorder;
      }, 1000);

      // Click the button
      buttonElement.click();

      console.log(`[InterfaceAI] Successfully clicked button: "${buttonText}"`);
      return {
        success: true,
        message: `Clicked button: "${buttonText}"`,
        elementTag: buttonElement.tagName,
        elementText: buttonElement.textContent || buttonElement.value,
      };
    } catch (error) {
      console.error("[InterfaceAI] Error clicking button:", error);
      return {
        success: false,
        message: `Error clicking button: ${error.message}`,
      };
    }
  } else {
    console.warn(`[InterfaceAI] Button not found: "${buttonText}"`);
    return {
      success: false,
      message: `Button with text "${buttonText}" not found on page`,
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
