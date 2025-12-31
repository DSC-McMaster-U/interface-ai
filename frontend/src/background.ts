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

interface CaptureScreenshotMessage {
  type: "CAPTURE_SCREENSHOT";
}

interface RequestWebsiteInfoFromContentMessage {
  type: "REQUEST_WEBSITE_INFO_FROM_CONTENT";
}

interface ScreenshotResponse {
  success: boolean;
  imageData?: string;
  error?: string;
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
 * Capture a screenshot of the current visible tab
 */
async function captureScreenshot(): Promise<ScreenshotResponse> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    const imageData = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: "png",
      quality: 100,
    });

    console.log("[InterfaceAI Background] Screenshot captured successfully");

    return {
      success: true,
      imageData, // This is a base64 data URL (e.g., "data:image/png;base64,...")
    };
  } catch (error) {
    console.error("[InterfaceAI Background] Screenshot capture error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to capture screenshot",
    };
  }
}

/**
 * Request website info from the content script (for backend-initiated requests)
 */
async function requestWebsiteInfoFromContent(): Promise<ApiResponse> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return {
        success: false,
        error: "No active tab found",
      };
    }

    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: "REQUEST_WEBSITE_INFO",
    });

    return response;
  } catch (error) {
    console.error(
      "[InterfaceAI Background] Request website info error:",
      error,
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to request website info",
    };
  }
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
      | CaptureScreenshotMessage
      | RequestWebsiteInfoFromContentMessage
      | { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ApiResponse | ScreenshotResponse) => void,
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

    // Handle screenshot capture request
    if (message.type === "CAPTURE_SCREENSHOT") {
      captureScreenshot()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to capture screenshot",
          });
        });

      return true;
    }

    // Handle request to get website info from content script (triggered by backend)
    if (message.type === "REQUEST_WEBSITE_INFO_FROM_CONTENT") {
      requestWebsiteInfoFromContent()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to request website info from content",
          });
        });

      return true;
    }

    return false;
  },
);

chrome.runtime.onInstalled.addListener((details) => {
  console.log(
    "[InterfaceAI] Extension",
    details.reason,
    chrome.runtime.getManifest().version,
  );
});

/**
 * Polling Configuration
 * The extension polls the backend for pending requests since service workers
 * cannot receive incoming HTTP requests directly.
 */
const POLLING_INTERVAL_MS = 1000;
let pollingEnabled = true;

interface PollResponse {
  pending: boolean;
}

/**
 * Poll the backend for pending requests
 * Backend should return { pending: true } if it needs website info
 */
async function pollForPendingRequests(): Promise<void> {
  if (!pollingEnabled) return;

  try {
    const response = await fetch(`${BACKEND_API}/api/pending-requests`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return;

    const data: PollResponse = await response.json();

    if (data.pending) {
      console.log("[InterfaceAI Background] Backend requested website info");
      await requestWebsiteInfoFromContent();
    }
  } catch (error) {
    // Silently fail
  }
}

// Start polling using Chrome alarms
chrome.alarms.create("pollBackend", {
  periodInMinutes: POLLING_INTERVAL_MS / 60000,
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollBackend") {
    pollForPendingRequests();
  }
});

/**
 * Toggle overlay on a specific tab
 * Shared function for both icon clicks and keyboard shortcuts
 */
async function toggleOverlay(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;

  try {
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
