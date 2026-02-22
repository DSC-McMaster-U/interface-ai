// ============================================
// background.js — Service Worker
// Routes commands from popup → content script.
// Handles screenshots (only background can do this).
// Falls back to background-level handling on restricted
// chrome:// pages where content scripts can't run.
// ============================================

var SCREENSHOT_FOLDER = 'InterfaceAI';

function takeScreenshot(sendResponse, options) {
  options = options || {};

  chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 }, function (dataUrl) {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    if (!dataUrl) {
      sendResponse({ success: false, error: 'captureVisibleTab returned empty result' });
      return;
    }

    var filename = options.filename ||
      'interfaceai_' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';

    var fullPath = SCREENSHOT_FOLDER + '/' + filename;

    chrome.downloads.download(
      {
        url: dataUrl,
        filename: fullPath,
        saveAs: false,
        conflictAction: 'uniquify'
      },
      function (downloadId) {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({
          success: true,
          downloadId: downloadId,
          filename: fullPath,
          dataUrl: dataUrl
        });
      }
    );
  });
}

// ── Commands that can run from background without a content script ──

function backgroundExecute(tabId, action, params, sendResponse) {
  switch (action) {
    case 'ping':
      sendResponse({ success: true, pong: true });
      return true;

    case 'screenshot':
      takeScreenshot(sendResponse, params);
      return true;

    case 'goto':
      if (!params.url) {
        sendResponse({ success: false, error: 'No URL provided' });
        return true;
      }
      chrome.tabs.update(tabId, { url: params.url }, function () {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, url: params.url });
        }
      });
      return true;

    case 'goBack':
      chrome.tabs.goBack(tabId, function () {
        sendResponse(chrome.runtime.lastError
          ? { success: false, error: chrome.runtime.lastError.message }
          : { success: true });
      });
      return true;

    case 'goForward':
      chrome.tabs.goForward(tabId, function () {
        sendResponse(chrome.runtime.lastError
          ? { success: false, error: chrome.runtime.lastError.message }
          : { success: true });
      });
      return true;

    case 'getPageStatus':
      chrome.tabs.get(tabId, function (tab) {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({
          success: true,
          title: tab.title || '',
          url: tab.url || '',
          note: 'Limited info — content script cannot run on this page',
          elements: []
        });
      });
      return true;

    default:
      return false;
  }
}

// ── Send command to content script, with retry + fallback ──

function sendToTab(tabId, action, params, sendResponse, retries) {
  if (retries === undefined) retries = 2;

  chrome.tabs.sendMessage(tabId, { action: action, params: params || {} }, function (result) {
    if (chrome.runtime.lastError) {
      if (retries > 0) {
        chrome.scripting.executeScript(
          { target: { tabId: tabId }, files: ['automation.js'] },
          function () {
            if (chrome.runtime.lastError) {
              // Content script injection failed (restricted page).
              // Try handling the command from background instead.
              var handled = backgroundExecute(tabId, action, params, sendResponse);
              if (!handled) {
                sendResponse({
                  success: false,
                  error: 'Cannot run this command on this page (chrome:// pages are restricted)'
                });
              }
              return;
            }
            setTimeout(function () {
              sendToTab(tabId, action, params, sendResponse, retries - 1);
            }, 500);
          }
        );
      } else {
        // Final retry exhausted — try background fallback
        var handled = backgroundExecute(tabId, action, params, sendResponse);
        if (!handled) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        }
      }
    } else {
      sendResponse(result);
    }
  });
}

// ── Message listener ──

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // Handle screenshot requests from content script (CLI path)
  if (message.action === 'screenshot' && sender.tab) {
    takeScreenshot(sendResponse, {
      filename: message.filename
    });
    return true;
  }

  // Handle commands from popup
  if (message.target !== 'background') return false;

  if (message.action === 'screenshot') {
    takeScreenshot(sendResponse, {
      filename: message.filename
    });
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