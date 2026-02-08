// ============================================
// background.js — Service Worker
// Routes commands from popup → active tab content script.
// Auto-injects the content script if it's not loaded yet.
// ============================================

function sendToTab(tabId, action, params, sendResponse, retries) {
  if (retries === undefined) retries = 2;

  chrome.tabs.sendMessage(tabId, { action, params: params || {} }, (result) => {
    if (chrome.runtime.lastError) {
      if (retries > 0) {
        // Inject and retry
        chrome.scripting.executeScript(
          { target: { tabId: tabId }, files: ['automation.js'] },
          function () {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: 'Cannot run on this page' });
              return;
            }
            setTimeout(function () {
              sendToTab(tabId, action, params, sendResponse, retries - 1);
            }, 500);
          }
        );
      } else {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      }
    } else {
      sendResponse(result);
    }
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.target !== 'background') return false;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0] || !tabs[0].id) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }
    sendToTab(tabs[0].id, message.action, message.params, sendResponse);
  });

  return true;
});

console.log('[InterfaceAI] Background service worker ready');
