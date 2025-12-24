/**
 * Content Script - Main entry point
 * Injects a glassmorphic overlay UI into any webpage using Shadow DOM
 */

import { InterfaceAIOverlay } from "./content/overlay";

// Initialize the overlay when the content script loads
const overlay = new InterfaceAIOverlay();

// Listen for messages from background script toggle visibility command
// Can add other Commands here from Manifest.json
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TOGGLE_OVERLAY") {
    overlay.toggle();
    sendResponse({ success: true });
  }
  return true;
});
