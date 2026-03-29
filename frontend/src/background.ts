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

interface GetUserMemoriesMessage {
  type: "GET_USER_MEMORIES";
}

interface AddUserMemoryMessage {
  type: "ADD_USER_MEMORY";
  payload: {
    field_key: string;
    fact: string;
  };
}

interface DeleteUserMemoryMessage {
  type: "DELETE_USER_MEMORY";
  payload: {
    memory_id?: string;
    field_key?: string;
  };
}

interface GetAgentMemoriesMessage {
  type: "GET_AGENT_MEMORIES";
}

interface DeleteAgentMemoryMessage {
  type: "DELETE_AGENT_MEMORY";
  payload: {
    memory_id: string;
  };
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

interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
}

interface UserMemory {
  id: string;
  fact: string;
  field_key: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

let agentTargetTabId: number | null = null;

async function broadcastAgentWsState(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => typeof tab.id === "number")
      .map(async (tab) => {
        try {
          await chrome.tabs.sendMessage(tab.id!, {
            type: "AGENT_WS_STATE",
            enabled: tab.id === agentTargetTabId,
          });
        } catch {
          // ignore tabs without a ready content script
        }
      }),
  );
}

async function setAgentTargetTab(tabId: number | null): Promise<void> {
  agentTargetTabId = tabId;
  await broadcastAgentWsState();
}

// ---------------------------------------------------------------------------
// Auth state (persisted in chrome.storage.local)
// ---------------------------------------------------------------------------

const AUTH_STORAGE_KEY = "interface_ai_auth_user";

async function getStoredAuth(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_STORAGE_KEY], (result) => {
      resolve((result?.[AUTH_STORAGE_KEY] as AuthUser) || null);
    });
  });
}

async function setStoredAuth(user: AuthUser | null): Promise<void> {
  return new Promise((resolve) => {
    if (user) {
      chrome.storage.local.set({ [AUTH_STORAGE_KEY]: user }, () => resolve());
    } else {
      chrome.storage.local.remove(AUTH_STORAGE_KEY, () => resolve());
    }
  });
}

// ---------------------------------------------------------------------------
// Google OAuth sign-in
// ---------------------------------------------------------------------------

async function googleSignIn(): Promise<ApiResponse> {
  try {
    // Get an OAuth2 access token using chrome.identity
    const token = await new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (result) => {
        const tok =
          typeof result === "string" ? result : (result as unknown as string);
        if (chrome.runtime.lastError || !tok) {
          reject(new Error(chrome.runtime.lastError?.message || "No token"));
        } else {
          resolve(tok);
        }
      });
    });

    // Fetch Google profile from userinfo endpoint
    const profileResp = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!profileResp.ok) {
      return {
        success: false,
        error: `Google API error ${profileResp.status}`,
      };
    }
    const googleProfile = (await profileResp.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };

    // Verify with our backend & create/get profile
    const backendResp = await fetch(`${BACKEND_API}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!backendResp.ok) {
      const errData = await backendResp.json().catch(() => ({}));
      return {
        success: false,
        error:
          (errData as Record<string, string>).error || "Backend auth failed",
      };
    }

    const backendData = (await backendResp.json()) as {
      user_id: string;
      email: string;
    };

    const authUser: AuthUser = {
      userId: backendData.user_id,
      email: backendData.email || googleProfile.email,
      name: googleProfile.name,
      picture: googleProfile.picture,
    };

    await setStoredAuth(authUser);

    return { success: true, data: authUser };
  } catch (error) {
    console.error("[InterfaceAI Background] Google Sign-In error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sign-in failed",
    };
  }
}

async function googleSignOut(): Promise<ApiResponse> {
  try {
    // Revoke the cached token
    const token = await new Promise<string | undefined>((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (result) => {
        const tok = typeof result === "string" ? result : undefined;
        resolve(tok);
      });
    });
    if (token) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => resolve());
      });
    }
    await setStoredAuth(null);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sign-out failed",
    };
  }
}

async function getAuthState(): Promise<ApiResponse> {
  const user = await getStoredAuth();
  return { success: true, data: user };
}

// ---------------------------------------------------------------------------
// User settings (backed by PostgreSQL via backend API)
// ---------------------------------------------------------------------------

async function getUserSettings(): Promise<ApiResponse> {
  const user = await getStoredAuth();
  if (!user) {
    return { success: false, error: "not_authenticated" };
  }

  try {
    const resp = await fetch(
      `${BACKEND_API}/api/profile?user_id=${encodeURIComponent(user.userId)}`,
    );
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const profile = (await resp.json()) as {
      user_id: string;
      preferences: Record<string, unknown>;
    };

    // Map from DB preferences to UserSettings shape
    const prefs = profile.preferences || {};
    const settings: UserSettings = {
      name: (prefs.name as string) || user.name || "",
      gender: (prefs.gender as string) || "",
      address: (prefs.address as string) || "",
      email: (prefs.email as string) || user.email || "",
      phone: (prefs.phone as string) || "",
      interests: Array.isArray(prefs.interests)
        ? (prefs.interests as string[])
        : [],
    };

    return { success: true, data: settings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get settings",
    };
  }
}

async function updateUserSettings(
  settings: UserSettings,
): Promise<ApiResponse> {
  const user = await getStoredAuth();
  if (!user) {
    return { success: false, error: "not_authenticated" };
  }

  try {
    const resp = await fetch(`${BACKEND_API}/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.userId,
        preferences: {
          name: settings.name,
          gender: settings.gender,
          address: settings.address,
          email: settings.email,
          phone: settings.phone,
          interests: settings.interests,
        },
      }),
    });

    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }

    const profile = await resp.json();
    return { success: true, data: profile };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}

async function getUserMemories(): Promise<ApiResponse> {
  const user = await getStoredAuth();
  if (!user) {
    return { success: false, error: "not_authenticated" };
  }

  try {
    const resp = await fetch(
      `${BACKEND_API}/api/user-memories?user_id=${encodeURIComponent(user.userId)}`,
    );
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const payload = (await resp.json()) as {
      memories?: UserMemory[];
    };
    return { success: true, data: payload.memories || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load memories",
    };
  }
}

async function addUserMemory(payload: {
  field_key: string;
  fact: string;
}): Promise<ApiResponse> {
  const user = await getStoredAuth();
  if (!user) {
    return { success: false, error: "not_authenticated" };
  }

  try {
    const resp = await fetch(`${BACKEND_API}/api/user-memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.userId,
        field_key: payload.field_key,
        fact: payload.fact,
      }),
    });
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as { memories?: UserMemory[] };
    return { success: true, data: data.memories || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add memory",
    };
  }
}

async function deleteUserMemory(payload: {
  memory_id?: string;
  field_key?: string;
}): Promise<ApiResponse> {
  const user = await getStoredAuth();
  if (!user) {
    return { success: false, error: "not_authenticated" };
  }

  const params = new URLSearchParams({ user_id: user.userId });
  if (payload.memory_id) params.set("memory_id", payload.memory_id);
  if (payload.field_key) params.set("field_key", payload.field_key);

  try {
    const resp = await fetch(`${BACKEND_API}/api/user-memories?${params.toString()}`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as { memories?: UserMemory[] };
    return { success: true, data: data.memories || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete memory",
    };
  }
}

async function getAgentMemories(): Promise<ApiResponse> {
  try {
    const resp = await fetch(`${BACKEND_API}/api/agent-memories`);
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const payload = (await resp.json()) as {
      memories?: UserMemory[];
      agent_id?: string;
    };
    return {
      success: true,
      data: {
        memories: payload.memories || [],
        agentId: payload.agent_id || "",
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load agent memories",
    };
  }
}

async function deleteAgentMemory(payload: {
  memory_id: string;
}): Promise<ApiResponse> {
  const params = new URLSearchParams({ memory_id: payload.memory_id });
  try {
    const resp = await fetch(
      `${BACKEND_API}/api/agent-memories?${params.toString()}`,
      { method: "DELETE" },
    );
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const payloadData = (await resp.json()) as {
      memories?: UserMemory[];
      agent_id?: string;
    };
    return {
      success: true,
      data: {
        memories: payloadData.memories || [],
        agentId: payloadData.agent_id || "",
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete agent memory",
    };
  }
}

/**
 * Advanced file search: sweeps Chrome history, home directory, and common
 * subdirectories. Handles files not in Chrome's download history.
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
 * Handle API requests from content scripts
 * Avoids CORS issues by making fetch calls from the service worker
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
 * Relay an action to the active tab's content script
 */
async function relayActionToTab(
  payload: Record<string, unknown>,
  preferredTabId?: number,
): Promise<ApiResponse> {
  let tabId = preferredTabId || agentTargetTabId;
  if (!tabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tabs[0]?.id ?? null;
  }
  if (!tabId) return { success: false, error: "No target tab found" };

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
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
      | GetUserMemoriesMessage
      | AddUserMemoryMessage
      | DeleteUserMemoryMessage
      | GetAgentMemoriesMessage
      | ExecuteActionMessage
      | { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ApiResponse) => void,
  ) => {
    console.log("[InterfaceAI Background] Received message:", message.type);

    if (message.type === "API_REQUEST") {
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

    // ----- Authentication -----
    if (message.type === "GOOGLE_SIGN_IN") {
      googleSignIn()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Sign-in failed",
          });
        });
      return true;
    }

    if (message.type === "GOOGLE_SIGN_OUT") {
      googleSignOut()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Sign-out failed",
          });
        });
      return true;
    }

    if (message.type === "GET_AUTH_STATE") {
      getAuthState()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Auth state error",
          });
        });
      return true;
    }

    if (message.type === "REGISTER_AGENT_TAB") {
      const senderTabId = _sender.tab?.id ?? null;
      setAgentTargetTab(senderTabId)
        .then(() => sendResponse({ success: true, data: { tabId: senderTabId } }))
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error ? error.message : "Tab registration failed",
          });
        });
      return true;
    }

    if (message.type === "GET_AGENT_WS_STATE") {
      sendResponse({
        success: true,
        data: { enabled: !!_sender.tab?.id && _sender.tab.id === agentTargetTabId },
      });
      return true;
    }

    // ----- Settings -----
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

    if (message.type === "GET_USER_MEMORIES") {
      getUserMemories()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to get memories",
          });
        });
      return true;
    }

    if (message.type === "ADD_USER_MEMORY") {
      addUserMemory((message as AddUserMemoryMessage).payload)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to add memory",
          });
        });
      return true;
    }

    if (message.type === "DELETE_USER_MEMORY") {
      deleteUserMemory((message as DeleteUserMemoryMessage).payload)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to delete memory",
          });
        });
      return true;
    }

    if (message.type === "GET_AGENT_MEMORIES") {
      getAgentMemories()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to get agent memories",
          });
        });
      return true;
    }

    if (message.type === "DELETE_AGENT_MEMORY") {
      deleteAgentMemory((message as DeleteAgentMemoryMessage).payload)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete agent memory",
          });
        });
      return true;
    }

    if (message.type === "EXECUTE_ACTION") {
      relayActionToTab((message as ExecuteActionMessage).payload, _sender.tab?.id)
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
 */
async function toggleOverlay(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;
  await setAgentTargetTab(tab.id);

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
  } catch (error) {
    console.log("[InterfaceAI] Injecting content script...");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
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
 * Handle extension icon clicks
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
