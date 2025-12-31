/**
 * Content Script - Main entry point
 * Injects a glassmorphic overlay UI into any webpage using Shadow DOM
 */

import { InterfaceAIOverlay } from "./content/overlay";
import { captureWebsiteInfo } from "./content/website-info";

const overlay = new InterfaceAIOverlay();

// Listen for messages from background script toggle visibility command
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TOGGLE_OVERLAY") {
    overlay.toggle();
    sendResponse({ success: true });
  }

  if (message.type === "REQUEST_WEBSITE_INFO") {
    captureWebsiteInfo().then((websiteInfo) => {
      chrome.runtime.sendMessage(
        {
          type: "API_REQUEST",
          payload: {
            endpoint: "/api/website-info",
            method: "POST",
            body: {
              ...websiteInfo,
              trigger: "backend_request",
            },
          },
        },
        (response) => {
          sendResponse({ success: response?.success ?? false });
        },
      );
    });

    return true;
  }

  return true;
});
