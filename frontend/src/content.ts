/**
 * Content Script - Main entry point
 * Injects a glassmorphic overlay UI into any webpage using Shadow DOM
 */

import { InterfaceAIOverlay } from "./content/overlay";
import { executeAction } from "./content/actions";
import type { ExecuteActionMessage } from "./content/types";

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
    return true;
  }

  if (message.type === "EXECUTE_ACTION") {
    const { payload } = message as ExecuteActionMessage;
    try {
      const result = executeAction(payload);
      sendResponse({ success: true, data: result });
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : "Action failed",
      });
    }
    return true;
  }

  return true;
});
