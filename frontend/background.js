/**
 * Background Script: Service worker for Chrome extension
 * Handles communication between popup and content scripts
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clickButtonOnPage") {
    // Forward the request to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "clickButton",
            buttonText: request.buttonText,
          },
          (response) => {
            sendResponse(response);
          }
        );
      } else {
        sendResponse({
          success: false,
          message: "No active tab found",
        });
      }
    });
    return true; // Keep message channel open for async response
  }
});

console.log("[InterfaceAI] Background script loaded");
