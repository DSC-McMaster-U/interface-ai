/**
 * Main InterfaceAI Overlay Class
 * Orchestrates all overlay functionality
 */

import { OVERLAY_STYLES } from "./styles";
import { OVERLAY_HTML } from "./template";
import { setupDragging } from "./dragging";
import { setupResizing } from "./resizing";
import {
  addMessage,
  showLoading,
  sendToBackground,
  setupInput,
  setupButtons,
  restoreMessages,
} from "./ui-handlers";
import {
  SETTINGS_STYLES,
  renderSettings,
  setupSettingsListeners,
  fetchUserSettings,
  updateUserSettings,
} from "./settings";
import { TEST_PANEL_STYLES, setupTestPanel } from "./test-panel";
import type { ApiRequestMessage, UserSettings } from "./types";

export class InterfaceAIOverlay {
  private shadowRoot: ShadowRoot | null = null;
  private container: HTMLElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private dragOffset = { x: 0, y: 0 };
  private resizeStart = { width: 0, height: 0, x: 0, y: 0 };

  private readonly visibilityStorageKey = "interface_ai_overlay_hidden";

  constructor() {
    this.init();
  }

  public appendAgentLog(message: string): void {
    const text = (message || "").trim();
    if (!text) return;
    addMessage(this.shadowRoot, text, "assistant");
  }

  private init(): void {
    // Prevent duplicate injection
    if (document.getElementById("interface-ai-root")) {
      console.log("[InterfaceAI] Overlay already exists, skipping injection");
      return;
    }

    // Create the host element
    const host = document.createElement("div");
    host.id = "interface-ai-root";
    document.body.appendChild(host);

    // Attach Shadow DOM
    this.shadowRoot = host.attachShadow({ mode: "open" });

    // Inject styles into Shadow DOM
    const styleElement = document.createElement("style");
    styleElement.textContent = OVERLAY_STYLES + SETTINGS_STYLES + TEST_PANEL_STYLES;
    this.shadowRoot.appendChild(styleElement);

    // Inject HTML into Shadow DOM
    const wrapper = document.createElement("div");
    wrapper.innerHTML = OVERLAY_HTML;
    this.shadowRoot.appendChild(wrapper);

    // Get reference to main container
    this.container = this.shadowRoot.getElementById("interface-ai-main");

    // Setup event listeners
    this.setupEventListeners();

    this.restoreState();

    console.log("[InterfaceAI] Overlay injected successfully");
  }

  private setupEventListeners(): void {
    // Dragging
    setupDragging(this.shadowRoot, this.container, {
      isDragging: this.isDragging,
      dragOffset: this.dragOffset,
    });

    // Resizing
    setupResizing(this.shadowRoot, this.container, {
      isResizing: this.isResizing,
      resizeStart: this.resizeStart,
    });

    // Buttons
    setupButtons(
      this.shadowRoot,
      this.container,
      () => this.toggleSettings(),
      () => this.toggleTest(),
      () => this.persistVisibility(true),
    );

    // Test panel
    setupTestPanel(this.shadowRoot);

    // Input handling
    setupInput(this.shadowRoot, {
      addMessage: (text, type) => addMessage(this.shadowRoot, text, type),
      showLoading: (show) => showLoading(this.shadowRoot, show),
      sendToBackground: (message: ApiRequestMessage) =>
        sendToBackground(message),
    });

    // Keyboard shortcuts - listen for chrome.commands
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    // Listen for command shortcuts from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "OPEN_SETTINGS") {
        this.toggleSettings();
      }
    });
  }

  private toggleSettings(): void {
    const chatView = this.shadowRoot?.getElementById("chat-view");
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    const testView = this.shadowRoot?.getElementById("test-view");
    if (!chatView || !settingsView || !testView) return;

    if (settingsView.classList.contains("hidden")) {
      testView.classList.add("hidden");
      this.openSettings();
    } else {
      this.closeSettings();
    }
  }

  private toggleTest(): void {
    const chatView = this.shadowRoot?.getElementById("chat-view");
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    const testView = this.shadowRoot?.getElementById("test-view");
    if (!chatView || !settingsView || !testView) return;

    if (testView.classList.contains("hidden")) {
      this.openTest();
    } else {
      this.closeTest();
    }
  }

  private openTest(): void {
    const chatView = this.shadowRoot?.getElementById("chat-view");
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    const testView = this.shadowRoot?.getElementById("test-view");
    if (!chatView || !settingsView || !testView) return;

    chatView.classList.add("hidden");
    settingsView.classList.add("hidden");
    testView.classList.remove("hidden");

    // Focus command input
    setTimeout(() => {
      (this.shadowRoot?.getElementById("test-cmd-input") as HTMLInputElement)?.focus();
    }, 50);
  }

  private closeTest(): void {
    const chatView = this.shadowRoot?.getElementById("chat-view");
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    const testView = this.shadowRoot?.getElementById("test-view");
    if (!chatView || !settingsView || !testView) return;

    testView.classList.add("hidden");
    chatView.classList.remove("hidden");
    this.focusInput();
  }

  private async openSettings(): Promise<void> {
    const chatView = this.shadowRoot?.getElementById("chat-view");
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    if (!chatView || !settingsView) return;

    // Hide chat and show settings
    chatView.classList.add("hidden");
    settingsView.classList.remove("hidden");

    // Fetch user settings
    const settings = await fetchUserSettings();
    if (settings) {
      renderSettings(this.shadowRoot, settings);

      // Setup event listeners for editing
      setupSettingsListeners(
        this.shadowRoot,
        settings,
        async (updatedSettings) => {
          await this.handleSettingsUpdate(updatedSettings);
        },
      );
    } else {
      const settingsContent =
        this.shadowRoot?.getElementById("settings-content");
      if (settingsContent) {
        settingsContent.innerHTML = `
          <div class="settings-loading">
            <span style="color: rgba(239, 68, 68, 0.8);">Failed to load settings</span>
          </div>
        `;
      }
    }
  }

  private async handleSettingsUpdate(
    updatedSettings: UserSettings,
  ): Promise<void> {
    const success = await updateUserSettings(updatedSettings);
    if (success) {
      renderSettings(this.shadowRoot, updatedSettings);
      setupSettingsListeners(this.shadowRoot, updatedSettings, async (s) => {
        await this.handleSettingsUpdate(s);
      });
    }
  }

  private closeSettings(): void {
    const chatView = this.shadowRoot?.getElementById("chat-view");
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    const testView = this.shadowRoot?.getElementById("test-view");
    if (!chatView || !settingsView || !testView) return;

    settingsView.classList.add("hidden");
    testView.classList.add("hidden");
    chatView.classList.remove("hidden");
    this.focusInput();
  }

  public show(): void {
    this.container?.classList.remove("hidden");
    this.persistVisibility(false);
    this.focusInput();
  }

  public hide(): void {
    this.container?.classList.add("hidden");
    this.persistVisibility(true);
  }

  public toggle(): void {
    this.container?.classList.toggle("hidden");
    const hidden = !!this.container?.classList.contains("hidden");
    this.persistVisibility(hidden);
    if (!hidden) {
      this.focusInput();
    }
  }

  private restoreState(): void {
    restoreMessages(this.shadowRoot).catch(() => {
      // ignore restore failures
    });

    chrome.storage.local.get([this.visibilityStorageKey], (result) => {
      const hidden = !!result?.[this.visibilityStorageKey];
      if (hidden) {
        this.container?.classList.add("hidden");
      } else {
        this.container?.classList.remove("hidden");
      }
    });
  }

  private persistVisibility(hidden: boolean): void {
    chrome.storage.local.set({ [this.visibilityStorageKey]: hidden });
  }

  private focusInput(): void {
    // Small delay to ensure DOM is ready after visibility change
    setTimeout(() => {
      const input = this.shadowRoot?.getElementById(
        "message-input",
      ) as HTMLInputElement;
      input?.focus();
    }, 50);
  }
}
