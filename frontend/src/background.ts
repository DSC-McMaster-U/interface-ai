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

interface ExecuteActionMessage {
  type: "EXECUTE_ACTION";
  payload: Record<string, unknown>;
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
 * Search for a local file by name and return it as a base64 data URL.
 *
 * Strategy 1 — chrome.downloads API: searches Chrome's download history for
 *   an exact or partial filename match, then fetches the file from its known
 *   full path. Most reliable for files in Downloads/Documents/Desktop.
 *
 * Strategy 2 — directory listing sweep: fetches the OS user directory listing
 *   (file:///C:/Users/ etc.) to discover the username, then tries common
 *   subdirectories. Handles files not in Chrome's download history.
 */
async function findAndFetchFile(fileName: string): Promise<ApiResponse> {
  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  }

  async function tryFetch(fileUrl: string): Promise<string | null> {
    try {
      const r = await fetch(fileUrl);
      if (!r.ok) return null;
      return blobToDataUrl(await r.blob());
    } catch {
      return null;
    }
  }

  // ── Strategy 1: chrome.downloads history search ──────────────────────────
  // Escape special regex chars in the filename, then search download history.
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dlItems = await new Promise<chrome.downloads.DownloadItem[]>(
    (resolve) => chrome.downloads.search({ filenameRegex: escaped }, resolve),
  );

  // Sort newest first and prefer completed items
  const sorted = dlItems
    .filter((i) => i.exists !== false)
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

  for (const item of sorted) {
    const fileUrl = `file:///${item.filename.replace(/\\/g, "/")}`;
    const dataUrl = await tryFetch(fileUrl);
    if (dataUrl) {
      console.log("[InterfaceAI] Found via downloads API:", item.filename);
      return { success: true, data: dataUrl };
    }
  }

  // ── Strategy 2: infer home directory from any download history item ───────
  // Anyone who has used Chrome has at least one download. Its path reveals the
  // exact OS username, letting us sweep common folders without directory listing.
  async function getHomeDir(): Promise<string | null> {
    const items = await new Promise<chrome.downloads.DownloadItem[]>(
      (resolve) => chrome.downloads.search({ limit: 20 }, resolve),
    );
    for (const item of items) {
      const p = item.filename.replace(/\\/g, "/");
      const m =
        p.match(/^([A-Za-z]:\/Users\/[^/]+)\//) ?? // Windows
        p.match(/^(\/home\/[^/]+)\//) ?? // Linux
        p.match(/^(\/Users\/[^/]+)\//); // macOS
      if (m) return m[1];
    }
    return null;
  }

  const subDirs = [
    "Downloads",
    "Documents",
    "Desktop",
    "Pictures",
    "Videos",
    "",
  ];
  const homeDir = await getHomeDir();

  if (homeDir) {
    for (const sub of subDirs) {
      const fileUrl = sub
        ? `file:///${homeDir.replace(/^\//, "")}/${sub}/${fileName}`
        : `file:///${homeDir.replace(/^\//, "")}/${fileName}`;
      const dataUrl = await tryFetch(fileUrl);
      if (dataUrl) {
        console.log("[InterfaceAI] Found via home dir sweep:", fileUrl);
        return { success: true, data: dataUrl };
      }
    }
  }

  // ── Strategy 3: directory listing sweep (last resort) ────────────────────
  async function listDir(dirUrl: string): Promise<string[]> {
    try {
      const r = await fetch(dirUrl);
      if (!r.ok) return [];
      const html = await r.text();
      const names: string[] = [];
      for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {
        const href = decodeURIComponent(m[1]).replace(/\/$/, "");
        if (!href || href.startsWith("?") || href.startsWith("#")) continue;
        const parts = href.split("/").filter(Boolean);
        const name = parts[parts.length - 1];
        if (name && name !== ".." && name !== "." && !name.endsWith(":")) {
          names.push(name);
        }
      }
      return [...new Set(names)];
    } catch {
      return [];
    }
  }

  const systemRoots = ["file:///C:/Users/", "file:///home/", "file:///Users/"];
  const skipFolders = new Set([
    "Public",
    "All Users",
    "Default",
    "Default User",
  ]);

  for (const root of systemRoots) {
    const userFolders = await listDir(root);
    for (const user of userFolders) {
      if (skipFolders.has(user)) continue;
      const userBase = `${root}${user}`;
      for (const sub of subDirs) {
        const fileUrl = sub
          ? `${userBase}/${sub}/${fileName}`
          : `${userBase}/${fileName}`;
        const dataUrl = await tryFetch(fileUrl);
        if (dataUrl) {
          console.log(
            "[InterfaceAI] Found via directory listing sweep:",
            fileUrl,
          );
          return { success: true, data: dataUrl };
        }
      }
    }
  }

  return {
    success: false,
    error:
      `"${fileName}" not found. Searched Chrome download history, ` +
      `${homeDir ? `${homeDir}/[Downloads|Documents|Desktop|Pictures|Videos]` : "common user directories"}, ` +
      `and directory listings.`,
  };
}

/**
 * Relay an action to the active tab's content script
 */
async function relayActionToTab(
  payload: Record<string, unknown>,
): Promise<ApiResponse> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return { success: false, error: "No active tab found" };

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tab.id!,
      { type: "EXECUTE_ACTION", payload },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error:
              chrome.runtime.lastError.message || "Tab communication error",
          });
        } else {
          resolve(
            response || { success: false, error: "No response from tab" },
          );
        }
      },
    );
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
      | ExecuteActionMessage
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

    if (message.type === "EXECUTE_ACTION") {
      relayActionToTab((message as ExecuteActionMessage).payload)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error ? error.message : "Action relay failed",
          });
        });

      return true;
    }

    if (message.type === "FIND_AND_FETCH_FILE") {
      const { fileName } = message as { type: string; fileName: string };
      findAndFetchFile(fileName)
        .then(sendResponse)
        .catch((error: unknown) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Search failed",
          }),
        );
      return true;
    }

    if (message.type === "FETCH_FILE") {
      const { fileUrl } = message as { type: string; fileUrl: string };
      fetch(fileUrl)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          return r.blob();
        })
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("FileReader failed"));
              reader.readAsDataURL(blob);
            }),
        )
        .then((dataUrl) => sendResponse({ success: true, data: dataUrl }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Fetch failed",
          }),
        );

      return true;
    }

    if (message.type === "TAKE_SCREENSHOT") {
      chrome.tabs
        .captureVisibleTab({ format: "png" })
        .then((dataUrl) => sendResponse({ success: true, data: dataUrl }))
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Screenshot failed",
          });
        });

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
