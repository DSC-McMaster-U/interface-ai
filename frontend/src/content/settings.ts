/**
 * Settings page functionality for user profile management
 *
 * Supports Google Sign-In and displays profile data from the database.
 */

import type {
  UserSettings,
  AuthUser,
  UserMemory,
  GetUserSettingsMessage,
  UpdateUserSettingsMessage,
  GetUserMemoriesMessage,
  AddUserMemoryMessage,
  DeleteAgentMemoryMessage,
  DeleteUserMemoryMessage,
  ApiResponse,
} from "./types";

/**
 * Settings page styles
 */
export const SETTINGS_STYLES = `
  .chat-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .chat-view.hidden {
    display: none;
  }

  .settings-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .settings-view.hidden {
    display: none;
  }

  .agents-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .agents-view.hidden {
    display: none;
  }

  .settings-header {
    padding: 16px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255, 255, 255, 0.02);
  }

  .settings-header h2 {
    font-size: 18px;
    font-weight: 500;
    margin: 0;
    color: var(--text-primary);
  }

  .settings-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .settings-content::-webkit-scrollbar {
    width: 4px;
  }

  .settings-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .settings-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  .settings-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .settings-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 20px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .settings-section {
    margin-top: 12px;
    margin-bottom: 12px;
  }

  .settings-section h3 {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .section-header-row h3 {
    margin-bottom: 0;
  }

  .reload-memories-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reload-memories-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.24);
  }

  .memory-meta {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.4;
    word-break: break-word;
  }

  .settings-field {
    margin-bottom: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .settings-field:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .settings-field-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .settings-field-value {
    font-size: 14px;
    color: var(--text-primary);
  }

  .settings-field-value.empty {
    color: var(--text-secondary);
    font-style: italic;
    opacity: 0.7;
  }

  .memories-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .memory-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .memory-item:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .memory-item:hover .memory-fact {
    text-decoration: line-through;
    opacity: 0.8;
  }

  .memory-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .memory-key {
    font-size: 10px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-secondary);
    word-break: break-word;
  }

  .memory-fact {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
    word-break: break-word;
  }

  .memory-delete {
    font-size: 11px;
    color: rgba(239, 68, 68, 0.85);
    opacity: 0;
    transition: opacity 0.2s ease;
    white-space: nowrap;
    padding-top: 2px;
  }

  .memory-item:hover .memory-delete {
    opacity: 1;
  }

  .add-memory-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 38px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
  }

  .add-memory-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .add-memory-btn svg {
    width: 16px;
    height: 16px;
  }

  /* ---------- Auth / Sign-In ---------- */

  .auth-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 20px;
    text-align: center;
  }

  .auth-section p {
    color: var(--text-secondary);
    font-size: 13px;
    margin: 0;
    line-height: 1.5;
  }

  .google-signin-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 24px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
  }

  .google-signin-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .google-signin-btn svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .auth-user-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .auth-user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    background: rgba(255, 255, 255, 0.1);
  }

  .auth-user-info {
    flex: 1;
    min-width: 0;
  }

  .auth-user-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .auth-user-email {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sign-out-btn {
    padding: 6px 14px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    color: rgba(239, 68, 68, 0.9);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .sign-out-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.4);
  }
`;

// Google "G" SVG logo
const GOOGLE_G_SVG = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

const USER_MEMORY_CACHE_PREFIX = "interface_ai_user_memories_cache";
const AGENT_MEMORY_CACHE_KEY = "interface_ai_agent_memories_cache";

function normalizeMemoryFieldKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanizeFieldKey(fieldKey: string): string {
  return fieldKey.replace(/_/g, " ").trim();
}

function memoryMetaHtml(memory: UserMemory): string {
  const metadata = memory.metadata || {};
  const parts = [
    String(metadata.domain || "").trim(),
    String(metadata.target_domain || "").trim(),
    String(metadata.task_type || "").trim(),
  ].filter(Boolean);
  return parts.length
    ? `<div class="memory-meta">${parts.join(" • ")}</div>`
    : "";
}

function renderMemoryList(
  memories: UserMemory[],
  options: {
    emptyText: string;
    deletable?: boolean;
    includeMeta?: boolean;
  },
): string {
  if (!memories.length) {
    return `<div class="settings-field-value empty">${options.emptyText}</div>`;
  }

  return memories
    .map(
      (memory) => `
        <button
          class="memory-item"
          data-memory-id="${memory.id}"
          data-field-key="${memory.field_key}"
          ${options.deletable ? "" : 'data-readonly="true"'}
        >
          <div class="memory-content">
            <div class="memory-key">${memory.field_key || "memory"}</div>
            <div class="memory-fact">${memory.fact}</div>
            ${options.includeMeta ? memoryMetaHtml(memory) : ""}
          </div>
          ${
            options.deletable
              ? '<div class="memory-delete">Delete</div>'
              : '<div class="memory-delete" style="opacity:0.65;">Read only</div>'
          }
        </button>
      `,
    )
    .join("");
}

/**
 * Render the sign-in screen (when not authenticated)
 */
export function renderSignIn(
  shadowRoot: ShadowRoot | null,
  onSignIn: () => void,
  errorMessage?: string,
): void {
  const settingsContent = shadowRoot?.getElementById("settings-content");
  if (!settingsContent) return;

  const errorHtml = errorMessage
    ? `<p style="color: rgba(239, 68, 68, 0.9); font-size: 12px; margin-top: 8px; padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">${errorMessage}</p>`
    : "";

  settingsContent.innerHTML = `
    <div class="auth-section">
      <p>Sign in with your Google account to sync your preferences and let InterfaceAI personalise your experience.</p>
      <button class="google-signin-btn" id="google-signin-btn">
        ${GOOGLE_G_SVG}
        Sign in with Google
      </button>
      ${errorHtml}
    </div>
  `;

  const btn = shadowRoot?.getElementById("google-signin-btn");
  btn?.addEventListener("click", onSignIn);
}

/**
 * Render settings page with user data (authenticated)
 */
export function renderSettings(
  shadowRoot: ShadowRoot | null,
  settings: UserSettings,
  memories: UserMemory[],
  authUser?: AuthUser | null,
  onSignOut?: () => void,
): void {
  const settingsContent = shadowRoot?.getElementById("settings-content");
  if (!settingsContent) return;

  const avatarUrl = authUser?.picture || "";
  const displayName = settings.name || authUser?.name || "";
  const displayEmail = settings.email || authUser?.email || "";

  const userBarHtml = authUser
    ? `
    <div class="auth-user-bar">
      ${avatarUrl ? `<img class="auth-user-avatar" src="${avatarUrl}" alt="avatar" />` : `<div class="auth-user-avatar"></div>`}
      <div class="auth-user-info">
        <div class="auth-user-name">${displayName || "User"}</div>
        <div class="auth-user-email">${displayEmail}</div>
      </div>
      <button class="sign-out-btn" id="sign-out-btn">Sign Out</button>
    </div>
  `
    : "";

  settingsContent.innerHTML = `
    ${userBarHtml}

    <div class="settings-section">
      <h3>Personal Information</h3>
      <div class="settings-field" data-field="name">
        <div class="settings-field-label">Name</div>
        <div class="settings-field-value">${settings.name || '<span class="empty">Not set</span>'}</div>
      </div>
      <div class="settings-field" data-field="gender">
        <div class="settings-field-label">Gender</div>
        <div class="settings-field-value">${settings.gender || '<span class="empty">Not set</span>'}</div>
      </div>
      <div class="settings-field" data-field="address">
        <div class="settings-field-label">Address</div>
        <div class="settings-field-value">${settings.address || '<span class="empty">Not set</span>'}</div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Contact Information</h3>
      <div class="settings-field" data-field="email">
        <div class="settings-field-label">Email</div>
        <div class="settings-field-value">${settings.email || '<span class="empty">Not set</span>'}</div>
      </div>
      <div class="settings-field" data-field="phone">
        <div class="settings-field-label">Phone</div>
        <div class="settings-field-value">${settings.phone || '<span class="empty">Not set</span>'}</div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header-row">
        <h3>User Memories</h3>
        <button class="reload-memories-btn" id="reload-user-memories-btn">Reload</button>
      </div>
      <div class="memories-container" id="memories-container">
        ${renderMemoryList(memories, {
          emptyText: "No cached user memories yet. Press Reload to sync from cloud.",
          deletable: true,
          includeMeta: false,
        })}
        <button class="add-memory-btn" id="add-memory-btn">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Add Memory
        </button>
      </div>
    </div>
  `;

  // Sign-out button
  if (onSignOut) {
    const signOutBtn = shadowRoot?.getElementById("sign-out-btn");
    signOutBtn?.addEventListener("click", onSignOut);
  }
}

export function renderAgentMemoriesPage(
  shadowRoot: ShadowRoot | null,
  memories: UserMemory[],
  agentId: string,
  isAdmin = false,
): void {
  const agentsContent = shadowRoot?.getElementById("agents-content");
  if (!agentsContent) return;

  agentsContent.innerHTML = `
    <div class="settings-section">
      <div class="settings-field">
        <div class="settings-field-label">Active Agent</div>
        <div class="settings-field-value">${agentId || "default"}</div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header-row">
        <h3>Agent Admin</h3>
      </div>
      <div class="settings-field" style="gap: 10px; align-items: center;">
        <input
          id="agent-admin-password"
          type="password"
          placeholder="${isAdmin ? "Admin access enabled" : "Enter admin password"}"
          style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: var(--text-primary); padding: 10px 12px;"
          ${isAdmin ? 'disabled="disabled"' : ""}
        />
        <button class="reload-memories-btn" id="agent-admin-unlock-btn">${isAdmin ? "Lock" : "Unlock"}</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header-row">
        <h3>Shared Agent Memories</h3>
        <button class="reload-memories-btn" id="reload-agent-memories-btn">Reload</button>
      </div>
      <div class="memories-container" id="agent-memories-container">
        ${renderMemoryList(memories, {
          emptyText: "No agent memories saved yet.",
          deletable: isAdmin,
          includeMeta: true,
        })}
      </div>
    </div>
  `;
}

export function setupAgentMemoriesListeners(
  shadowRoot: ShadowRoot | null,
  currentMemories: UserMemory[],
  isAdmin: boolean,
  onToggleAdmin: (password: string) => Promise<void>,
  onReload: () => Promise<void>,
  onDelete: (memory: UserMemory) => Promise<void>,
): void {
  const unlockBtn = shadowRoot?.getElementById("agent-admin-unlock-btn");
  unlockBtn?.addEventListener("click", async () => {
    if (isAdmin) {
      await onToggleAdmin("");
      return;
    }
    const input = shadowRoot?.getElementById(
      "agent-admin-password",
    ) as HTMLInputElement | null;
    await onToggleAdmin(input?.value || "");
  });

  const reloadBtn = shadowRoot?.getElementById("reload-agent-memories-btn");
  reloadBtn?.addEventListener("click", async () => {
    await onReload();
  });

  if (!isAdmin) return;

  const memoryItems = shadowRoot?.querySelectorAll(
    "#agent-memories-container .memory-item",
  );
  memoryItems?.forEach((item) => {
    item.addEventListener("click", async () => {
      const memoryId = item.getAttribute("data-memory-id") || "";
      const memory = currentMemories.find((entry) => entry.id === memoryId);
      if (!memory) return;
      const confirmed = confirm(`Delete agent memory "${memory.fact}"?`);
      if (!confirmed) return;
      await onDelete(memory);
    });
  });
}

/**
 * Setup settings page event listeners
 */
export function setupSettingsListeners(
  shadowRoot: ShadowRoot | null,
  currentSettings: UserSettings,
  currentMemories: UserMemory[],
  onUpdate: (settings: UserSettings) => Promise<void>,
  onAddMemory: (fieldKey: string, fact: string) => Promise<void>,
  onDeleteMemory: (memory: UserMemory) => Promise<void>,
  onReloadMemories: () => Promise<void>,
): void {
  // Click on fields to edit
  const fields = shadowRoot?.querySelectorAll(".settings-field");
  fields?.forEach((field) => {
    field.addEventListener("click", async () => {
      const fieldName = field.getAttribute("data-field") as keyof UserSettings;
      if (!fieldName || fieldName === "interests") return;

      const currentValue = currentSettings[fieldName] as string;
      const newValue = prompt(`Enter new ${fieldName}:`, currentValue);

      if (newValue !== null && newValue.trim()) {
        currentSettings[fieldName] = newValue.trim() as never;
        await onUpdate(currentSettings);
      }
    });
  });

  const memoryItems = shadowRoot?.querySelectorAll(".memory-item");
  memoryItems?.forEach((item) => {
    item.addEventListener("click", async () => {
      const memoryId = item.getAttribute("data-memory-id") || "";
      const fieldKey = item.getAttribute("data-field-key") || "";
      const memory = currentMemories.find(
        (entry) => entry.id === memoryId && entry.field_key === fieldKey,
      );
      if (!memory) return;

      const confirmed = confirm(`Delete memory "${memory.fact}"?`);
      if (!confirmed) return;

      await onDeleteMemory(memory);
    });
  });

  const addBtn = shadowRoot?.getElementById("add-memory-btn");
  addBtn?.addEventListener("click", async () => {
    const rawFieldKey = prompt(
      "Enter a memory label (example: favorite_team or job_status):",
    );
    if (!rawFieldKey || !rawFieldKey.trim()) return;

    const fieldKey = normalizeMemoryFieldKey(rawFieldKey);
    if (!fieldKey) {
      alert("Memory label must contain letters or numbers.");
      return;
    }

    const value = prompt(
      `Enter the value for "${humanizeFieldKey(fieldKey)}":`,
    );
    if (!value || !value.trim()) return;

    const fact = `The user's ${humanizeFieldKey(fieldKey)} is ${value.trim()}.`;
    await onAddMemory(fieldKey, fact);
  });

  const reloadBtn = shadowRoot?.getElementById("reload-user-memories-btn");
  reloadBtn?.addEventListener("click", async () => {
    await onReloadMemories();
  });
}

export interface SignInResult {
  user: AuthUser | null;
  error?: string;
}

/**
 * Request Google Sign-In via background script
 */
export async function requestGoogleSignIn(): Promise<SignInResult> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GOOGLE_SIGN_IN" },
      (response: ApiResponse) => {
        if (chrome.runtime.lastError) {
          console.error("[Settings] Sign-in error:", chrome.runtime.lastError);
          resolve({
            user: null,
            error: chrome.runtime.lastError.message || "Chrome runtime error",
          });
        } else if (response.success && response.data) {
          resolve({ user: response.data as AuthUser });
        } else {
          console.error("[Settings] Sign-in failed:", response.error);
          resolve({ user: null, error: response.error || "Sign-in failed" });
        }
      },
    );
  });
}

/**
 * Request Google Sign-Out via background script
 */
export async function requestGoogleSignOut(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GOOGLE_SIGN_OUT" },
      (response: ApiResponse) => {
        if (chrome.runtime.lastError) {
          console.error("[Settings] Sign-out error:", chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(response.success);
        }
      },
    );
  });
}

/**
 * Get current auth state from background script
 */
export async function getAuthState(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_AUTH_STATE" },
      (response: ApiResponse) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else if (response.success && response.data) {
          resolve(response.data as AuthUser);
        } else {
          resolve(null);
        }
      },
    );
  });
}

/**
 * Fetch user settings from background script
 */
export async function fetchUserSettings(): Promise<UserSettings | null> {
  return new Promise((resolve) => {
    const message: GetUserSettingsMessage = { type: "GET_USER_SETTINGS" };

    chrome.runtime.sendMessage(message, (response: ApiResponse) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Settings] Error fetching settings:",
          chrome.runtime.lastError,
        );
        resolve(null);
      } else if (response.success && response.data) {
        resolve(response.data as UserSettings);
      } else {
        console.error("[Settings] Failed to fetch settings:", response.error);
        resolve(null);
      }
    });
  });
}

/**
 * Update user settings via background script
 */
export async function updateUserSettings(
  settings: UserSettings,
): Promise<boolean> {
  return new Promise((resolve) => {
    const message: UpdateUserSettingsMessage = {
      type: "UPDATE_USER_SETTINGS",
      payload: settings,
    };

    chrome.runtime.sendMessage(message, (response: ApiResponse) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Settings] Error updating settings:",
          chrome.runtime.lastError,
        );
        resolve(false);
      } else if (response.success) {
        resolve(true);
      } else {
        console.error("[Settings] Failed to update settings:", response.error);
        resolve(false);
      }
    });
  });
}

export async function fetchUserMemories(): Promise<UserMemory[] | null> {
  return new Promise((resolve) => {
    const message: GetUserMemoriesMessage = { type: "GET_USER_MEMORIES" };

    chrome.runtime.sendMessage(message, (response: ApiResponse) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Settings] Error fetching user memories:",
          chrome.runtime.lastError,
        );
        resolve(null);
      } else if (response.success && Array.isArray(response.data)) {
        resolve(response.data as UserMemory[]);
      } else {
        console.error(
          "[Settings] Failed to fetch user memories:",
          response.error,
        );
        resolve(null);
      }
    });
  });
}

export async function addUserMemory(
  fieldKey: string,
  fact: string,
): Promise<UserMemory[] | null> {
  return new Promise((resolve) => {
    const message: AddUserMemoryMessage = {
      type: "ADD_USER_MEMORY",
      payload: {
        field_key: fieldKey,
        fact,
      },
    };

    chrome.runtime.sendMessage(message, (response: ApiResponse) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Settings] Error adding user memory:",
          chrome.runtime.lastError,
        );
        resolve(null);
      } else if (response.success && Array.isArray(response.data)) {
        resolve(response.data as UserMemory[]);
      } else {
        console.error("[Settings] Failed to add user memory:", response.error);
        resolve(null);
      }
    });
  });
}

export async function deleteUserMemory(
  memory: UserMemory,
): Promise<UserMemory[] | null> {
  return new Promise((resolve) => {
    const message: DeleteUserMemoryMessage = {
      type: "DELETE_USER_MEMORY",
      payload: {
        memory_id: memory.id,
        field_key: memory.field_key,
      },
    };

    chrome.runtime.sendMessage(message, (response: ApiResponse) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Settings] Error deleting user memory:",
          chrome.runtime.lastError,
        );
        resolve(null);
      } else if (response.success && Array.isArray(response.data)) {
        resolve(response.data as UserMemory[]);
      } else {
        console.error(
          "[Settings] Failed to delete user memory:",
          response.error,
        );
        resolve(null);
      }
    });
  });
}

function userMemoryCacheKey(userId: string): string {
  return `${USER_MEMORY_CACHE_PREFIX}:${userId}`;
}

export async function getCachedUserMemories(
  userId: string,
): Promise<UserMemory[] | null> {
  const key = userMemoryCacheKey(userId);
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      const cached = result?.[key];
      resolve(Array.isArray(cached) ? (cached as UserMemory[]) : null);
    });
  });
}

export async function setCachedUserMemories(
  userId: string,
  memories: UserMemory[],
): Promise<void> {
  const key = userMemoryCacheKey(userId);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: memories }, () => resolve());
  });
}

export async function getCachedAgentMemories(): Promise<{
  agentId: string;
  memories: UserMemory[];
} | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([AGENT_MEMORY_CACHE_KEY], (result) => {
      const cached = result?.[AGENT_MEMORY_CACHE_KEY];
      if (
        cached &&
        typeof cached === "object" &&
        Array.isArray((cached as { memories?: unknown[] }).memories)
      ) {
        resolve(
          cached as {
            agentId: string;
            memories: UserMemory[];
          },
        );
        return;
      }
      resolve(null);
    });
  });
}

export async function setCachedAgentMemories(payload: {
  agentId: string;
  memories: UserMemory[];
}): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [AGENT_MEMORY_CACHE_KEY]: payload }, () =>
      resolve(),
    );
  });
}

export async function fetchAgentMemories(): Promise<{
  agentId: string;
  memories: UserMemory[];
} | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_AGENT_MEMORIES" },
      (response: ApiResponse) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Settings] Error fetching agent memories:",
            chrome.runtime.lastError,
          );
          resolve(null);
        } else if (
          response.success &&
          response.data &&
          typeof response.data === "object"
        ) {
          const data = response.data as {
            agentId?: string;
            memories?: UserMemory[];
          };
          resolve({
            agentId: data.agentId || "",
            memories: Array.isArray(data.memories) ? data.memories : [],
          });
        } else {
          console.error(
            "[Settings] Failed to fetch agent memories:",
            response.error,
          );
          resolve(null);
        }
      },
    );
  });
}

export async function deleteAgentMemory(
  memory: UserMemory,
): Promise<{
  agentId: string;
  memories: UserMemory[];
} | null> {
  return new Promise((resolve) => {
    const message: DeleteAgentMemoryMessage = {
      type: "DELETE_AGENT_MEMORY",
      payload: {
        memory_id: memory.id,
      },
    };

    chrome.runtime.sendMessage(message, (response: ApiResponse) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Settings] Error deleting agent memory:",
          chrome.runtime.lastError,
        );
        resolve(null);
      } else if (
        response.success &&
        response.data &&
        typeof response.data === "object"
      ) {
        const data = response.data as {
          agentId?: string;
          memories?: UserMemory[];
        };
        resolve({
          agentId: data.agentId || "",
          memories: Array.isArray(data.memories) ? data.memories : [],
        });
      } else {
        console.error(
          "[Settings] Failed to delete agent memory:",
          response.error,
        );
        resolve(null);
      }
    });
  });
}
