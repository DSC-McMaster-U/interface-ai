/**
 * Content Script - Main entry point
 * Injects a glassmorphic overlay UI into any webpage using Shadow DOM
 */

import { InterfaceAIOverlay } from "./content/overlay";

// Initialize the overlay when the content script loads
const overlay = new InterfaceAIOverlay();

window.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as { source?: string; type?: string; message?: string };
  if (!data || data.source !== "interface-ai") return;
  if (data.type === "AGENT_LOG") {
    overlay.appendAgentLog(data.message || "");
  }
});

// Listen for messages from background script toggle visibility command
// Can add other Commands here from Manifest.json
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TOGGLE_OVERLAY") {
    overlay.toggle();
    sendResponse({ success: true });
  }
  return true;
});
