// ============================================
// background.js — Service Worker
// Routes commands from popup → content script.
// Handles screenshots (only background can do this).
// ============================================

function takeScreenshot(sendResponse) {
  chrome.tabs.captureVisibleTab(null, { format: 'png' }, function (dataUrl) {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true, dataUrl: dataUrl });
    }
  });
}

function sendToTab(tabId, action, params, sendResponse, retries) {
  if (retries === undefined) retries = 2;

  chrome.tabs.sendMessage(tabId, { action: action, params: params || {} }, function (result) {
    if (chrome.runtime.lastError) {
      if (retries > 0) {
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
  // Handle screenshot requests from content script (CLI path)
  if (message.action === 'screenshot' && sender.tab) {
    takeScreenshot(sendResponse);
    return true;
  }

  // Handle commands from popup
  if (message.target !== 'background') return false;

  // Screenshot from popup
  if (message.action === 'screenshot') {
    takeScreenshot(sendResponse);
    return true;
  }

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
