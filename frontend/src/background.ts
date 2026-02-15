/**
 * Background Service Worker for InterfaceAI Chrome Extension
 * Handles API requests from content scripts to avoid CORS issues
 */

// URL for the backend API
const BACKEND_API = "http://localhost:5000";

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

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
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
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener(
  (
    message:
      | ApiRequestMessage
      | GetUserSettingsMessage
      | UpdateUserSettingsMessage
      | { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ApiResponse) => void,
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

    // Test panel / automation: screenshot or forward commands to tab
    const testMsg = message as { target?: string; action?: string; params?: Record<string, unknown> };
    if (testMsg.action === "screenshot") {
      const windowId = _sender.tab?.windowId ?? 0;
      chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          (sendResponse as (r: unknown) => void)({ success: true, dataUrl });
        }
      });
      return true;
    }
    if (testMsg.target === "background" && testMsg.action) {
      const tabId = _sender.tab?.id;
      if (!tabId) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const t = tabs[0];
          if (t?.id) {
            chrome.tabs.sendMessage(t.id, { action: testMsg.action, params: testMsg.params || {} }, sendResponse);
          } else {
            sendResponse({ success: false, error: "No active tab" });
          }
        });
      } else {
        chrome.tabs.sendMessage(tabId, { action: testMsg.action, params: testMsg.params || {} }, sendResponse);
      }
      return true;
    }

    return false;
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
        files: ["content.js", "automation.js"],
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
