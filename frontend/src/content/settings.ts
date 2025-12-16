/**
 * Settings page functionality for user profile management
 *
 * TODO Change the UI of settings
 */

import type {
  UserSettings,
  GetUserSettingsMessage,
  UpdateUserSettingsMessage,
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

  .settings-header {
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: rgba(99, 102, 241, 0.9);
  }

  .settings-subtitle {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    margin: 0;
    font-style: italic;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .settings-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 20px;
    color: rgba(99, 102, 241, 0.8);
    font-size: 13px;
  }

  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: rgba(0, 0, 0, 0.8);
  }

  .settings-field {
    margin-bottom: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .settings-field:hover {
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
  }

  .settings-field-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .settings-field-value {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.9);
  }

  .settings-field-value.empty {
    color: rgba(0, 0, 0, 0.4);
    font-style: italic;
  }

  .interests-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .interest-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 12px;
    font-size: 12px;
    color: rgba(99, 102, 241, 0.9);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .interest-tag:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
  }

  .interest-tag-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin-left: 2px;
  }

  .interest-tag-remove svg {
    width: 10px;
    height: 10px;
  }

  .add-interest-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .add-interest-btn:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
  }

  .add-interest-btn svg {
    width: 14px;
    height: 14px;
    color: rgba(99, 102, 241, 0.9);
  }
`;

/**
 * Render settings page with user data
 */
export function renderSettings(
  shadowRoot: ShadowRoot | null,
  settings: UserSettings,
): void {
  const settingsContent = shadowRoot?.getElementById("settings-content");
  if (!settingsContent) return;

  settingsContent.innerHTML = `
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
      <h3>Interests</h3>
      <div class="interests-container" id="interests-container">
        ${settings.interests
          .map(
            (interest, index) => `
          <div class="interest-tag" data-index="${index}">
            <span>${interest}</span>
            <div class="interest-tag-remove">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </div>
          </div>
        `,
          )
          .join("")}
        <button class="add-interest-btn" id="add-interest-btn">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Setup settings page event listeners
 */
export function setupSettingsListeners(
  shadowRoot: ShadowRoot | null,
  currentSettings: UserSettings,
  onUpdate: (settings: UserSettings) => Promise<void>,
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

  // Remove interest tags
  const interestTags = shadowRoot?.querySelectorAll(".interest-tag");
  interestTags?.forEach((tag) => {
    tag.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".interest-tag-remove")) {
        const index = parseInt(tag.getAttribute("data-index") || "0");
        currentSettings.interests = currentSettings.interests.filter(
          (_, i) => i !== index,
        );
        await onUpdate(currentSettings);
      }
    });
  });

  // Add interest button
  const addBtn = shadowRoot?.getElementById("add-interest-btn");
  addBtn?.addEventListener("click", async () => {
    const newInterest = prompt("Enter new interest:");
    if (newInterest && newInterest.trim()) {
      currentSettings.interests = [
        ...currentSettings.interests,
        newInterest.trim(),
      ];
      await onUpdate(currentSettings);
    }
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
