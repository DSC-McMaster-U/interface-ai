/**
 * Background Service Worker for InterfaceAI Chrome Extension
 * Handles API requests from content scripts to avoid CORS issues
 */

// URL for the backend API
const BACKEND_API = "http://localhost:5000";
const SCREENSHOT_FOLDER = "InterfaceAI";

/**
 * Message types for communication with content scripts
 */
interface ApiRequestMessage {
  type: "API_REQUEST";
  payload: {
    endpoint: string;
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
  };
}

interface GetUserSettingsMessage {
  type: "GET_USER_SETTINGS";
}

interface UpdateUserSettingsMessage {
  type: "UPDATE_USER_SETTINGS";
  payload: UserSettings;
}

interface AutomationCommandMessage {
  type?: never
  target: "background";
  action: string;
  params?: Record<string, unknown>;
  filename?: string;
}

interface ContentScriptScreenshotMessage {
  type?: never
  action: "screenshot";
  filename?: string;
}

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface ScreenshotResponse {
  success: boolean;
  downloadId?: number;
  filename?: string;
  dataUrl?: string;
  error?: string;
}

interface AutomationResponse {
  success: boolean;
  [key: string]: unknown;
}

interface UserSettings {
  name: string;
  gender: string;
  address: string;
  email: string;
  phone: string;
  interests: string[];
}

/**
 * Fake backend storage for user settings
 * TODO fetch from an actual backend API
 */
let userSettings: UserSettings = {
  name: "John Doe",
  gender: "Male",
  address: "123 Main St, City, State",
  email: "john.doe@example.com",
  phone: "(123) 456-7890",
  interests: ["Programming", "AI", "Web Development", "Machine Learning"],
};

/**
 * Handle API requests from content scripts
 * Avoids CORS issues by making fetch calls from the service worker
 * Can see the console logs in the service worker logs
 */
async function handleApiRequest(
  payload: ApiRequestMessage["payload"],
): Promise<ApiResponse> {
  try {
    const { endpoint, method, body, headers = {} } = payload;
    const url = `${BACKEND_API}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    console.log(`[InterfaceAI Background] Fetching: ${method} ${url}`);

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[InterfaceAI Background] API Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * TODO get user settings backend API
 */
async function getUserSettings(): Promise<ApiResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log("[InterfaceAI Background] Fetching user settings");
  return {
    success: true,
    data: userSettings,
  };
}

/**
 * TODO Update user settings backend API
 */
async function updateUserSettings(
  settings: UserSettings,
): Promise<ApiResponse> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log("[InterfaceAI Background] Updating user settings", settings);
  userSettings = { ...settings };

  return {
    success: true,
    data: userSettings,
  };
}

/**
 * Take a screenshot of the current tab and save it to the downloads folder
 */
function takeScreenshot(
  sendResponse: (response: ScreenshotResponse) => void,
  options: { filename?: string } = {},
): void {
  chrome.tabs.captureVisibleTab(null as unknown as number, { format: "png", quality: 100 }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    if (!dataUrl) {
      sendResponse({ success: false, error: "captureVisibleTab returned empty result" });
      return;
    }

    const filename =
      options.filename ??
      `interfaceai_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    const fullPath = `${SCREENSHOT_FOLDER}/${filename}`;

    chrome.downloads.download(
      { url: dataUrl, filename: fullPath, saveAs: false, conflictAction: "uniquify" },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ success: true, downloadId, filename: fullPath, dataUrl });
      },
    );
  });
}

/**
 * Commands that can run from the background without a content script
 * Used as a fallback for restricted pages like chrome://
 */
function backgroundExecute(
  tabId: number,
  action: string,
  params: Record<string, unknown>,
  sendResponse: (response: AutomationResponse) => void,
): boolean {
  switch (action) {
    case "ping":
      sendResponse({ success: true, pong: true });
      return true;

    case "screenshot":
      takeScreenshot(sendResponse as (r: ScreenshotResponse) => void, params as { filename?: string });
      return true;

    case "goto":
      if (!params.url) {
        sendResponse({ success: false, error: "No URL provided" });
        return true;
      }
      chrome.tabs.update(tabId, { url: params.url as string }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, url: params.url });
        }
      });
      return true;

    case "goBack":
      chrome.tabs.goBack(tabId, () => {
        sendResponse(
          chrome.runtime.lastError
            ? { success: false, error: chrome.runtime.lastError.message }
            : { success: true },
        );
      });
      return true;

    case "goForward":
      chrome.tabs.goForward(tabId, () => {
        sendResponse(
          chrome.runtime.lastError
            ? { success: false, error: chrome.runtime.lastError.message }
            : { success: true },
        );
      });
      return true;

    case "getPageStatus":
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({
          success: true,
          title: tab.title ?? "",
          url: tab.url ?? "",
          note: "Limited info — content script cannot run on this page",
          elements: [],
        });
      });
      return true;

    default:
      return false;
  }
}

/**
 * Send command to content script, with retry and fallback to backgroundExecute
 */
function sendToTab(
  tabId: number,
  action: string,
  params: Record<string, unknown>,
  sendResponse: (response: AutomationResponse) => void,
  retries = 2,
): void {
  chrome.tabs.sendMessage(tabId, { action, params }, (result) => {
    if (chrome.runtime.lastError) {
      if (retries > 0) {
        chrome.scripting.executeScript(
          { target: { tabId }, files: ["automation.js"] },
          () => {
            if (chrome.runtime.lastError) {
              // Content script injection failed (restricted page).
              // Try handling the command from background instead.
              const handled = backgroundExecute(tabId, action, params, sendResponse);
              if (!handled) {
                sendResponse({
                  success: false,
                  error: "Cannot run this command on this page (chrome:// pages are restricted)",
                });
              }
              return;
            }
            setTimeout(() => sendToTab(tabId, action, params, sendResponse, retries - 1), 500);
          },
        );
      } else {
        // Final retry exhausted — try background fallback
        const handled = backgroundExecute(tabId, action, params, sendResponse);
        if (!handled) {
          sendResponse({ success: false, error: chrome.runtime.lastError?.message ?? "Unknown error" });
        }
      }
    } else {
      sendResponse(result as AutomationResponse);
    }
  });
}

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener(
  (
    message:
      | ApiRequestMessage
      | GetUserSettingsMessage
      | UpdateUserSettingsMessage
      | AutomationCommandMessage
      | ContentScriptScreenshotMessage
      | { type?: string; action?: string; target?: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    console.log("[InterfaceAI Background] Received message:", message.type);

    if (message.type === "API_REQUEST") {
      // Handle API request asynchronously
      handleApiRequest((message as ApiRequestMessage).payload)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });

      // Return true to indicate we'll send a response asynchronously
      return true;
    }

    // Handle settings get and update request
    if (message.type === "GET_USER_SETTINGS") {
      getUserSettings()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to get settings",
          });
        });

      return true;
    }

    if (message.type === "UPDATE_USER_SETTINGS") {
      updateUserSettings((message as UpdateUserSettingsMessage).payload)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to update settings",
          });
        });

      return true;
    }

    // Handle screenshot requests from content script (CLI path)
    const actionMsg = message as ContentScriptScreenshotMessage;
    if (actionMsg.action === "screenshot" && sender.tab) {
      takeScreenshot(sendResponse as (r: ScreenshotResponse) => void, { filename: actionMsg.filename });
      return true;
    }

    // Handle automation commands from the frontend UI
    const cmdMsg = message as AutomationCommandMessage;
    if (cmdMsg.target !== "background") return false;

    if (cmdMsg.action === "screenshot") {
      takeScreenshot(sendResponse as (r: ScreenshotResponse) => void, { filename: cmdMsg.filename });
      return true;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs?.[0]?.id) {
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }
      sendToTab(
        tabs[0].id,
        cmdMsg.action,
        (cmdMsg.params ?? {}) as Record<string, unknown>,
        sendResponse as (r: AutomationResponse) => void,
      );
    });

    return true;
  },
);

/**
 * Console message on install
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log(
    "[InterfaceAI] Extension",
    details.reason,
    chrome.runtime.getManifest().version,
  );
});

/**
 * Toggle overlay on a specific tab
 * Shared function for both icon clicks and keyboard shortcuts
 */
async function toggleOverlay(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;

  try {
    // Send message to content script to toggle overlay visibility
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
  } catch (error) {
    // Content script might not be loaded yet, try injecting it
    console.log("[InterfaceAI] Injecting content script...");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      // After injection, send the toggle message to show the overlay
      // Small delay to ensure content script is fully initialized
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id!, { type: "TOGGLE_OVERLAY" });
        } catch (msgError) {
          console.error(
            "[InterfaceAI] Failed to send toggle message:",
            msgError,
          );
        }
      }, 100);
    } catch (injectError) {
      console.error(
        "[InterfaceAI] Failed to inject content script:",
        injectError,
      );
    }
  }
}

/**
 * Handle extension icon clicks - toggle the overlay on the current tab
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[InterfaceAI] Extension icon clicked", tab.id);
  await toggleOverlay(tab);
});

/**
 * Handle keyboard shortcuts
 */
chrome.commands?.onCommand?.addListener(async (command) => {
  console.log("[InterfaceAI] Command received:", command);

  if (command === "toggle-overlay") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await toggleOverlay(tabs[0]);
    }
  }

  if (command === "open-settings") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "OPEN_SETTINGS" });
    }
  }
});
