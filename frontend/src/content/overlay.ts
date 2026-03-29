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
  setupInput,
  setupButtons,
  restoreMessages,
} from "./ui-handlers";
import {
  SETTINGS_STYLES,
  renderSettings,
  renderAgentMemoriesPage,
  renderSignIn,
  setupSettingsListeners,
  fetchUserSettings,
  fetchUserMemories,
  fetchAgentMemories,
  updateUserSettings,
  addUserMemory,
  deleteUserMemory,
  getCachedUserMemories,
  setCachedUserMemories,
  getCachedAgentMemories,
  setCachedAgentMemories,
  requestGoogleSignIn,
  requestGoogleSignOut,
  getAuthState,
} from "./settings";
import { TEST_PANEL_STYLES, setupTestPanel } from "./test-panel";
import type { UserSettings, AuthUser, UserMemory } from "./types";

export class InterfaceAIOverlay {
  private shadowRoot: ShadowRoot | null = null;
  private container: HTMLElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private dragOffset = { x: 0, y: 0 };
  private resizeStart = { width: 0, height: 0, x: 0, y: 0 };

  private readonly visibilityStorageKey = "interface_ai_overlay_hidden";
  private authUser: AuthUser | null = null;
  private userMemories: UserMemory[] = [];
  private agentMemories: UserMemory[] = [];
  private agentId = "";

  constructor() {
    this.init();
  }

  private notifyAgentTabActive(): void {
    chrome.runtime.sendMessage({ type: "REGISTER_AGENT_TAB" }, () => {
      // best-effort sync only
    });
  }

  public appendAgentLog(message: string): void {
    const text = (message || "").trim();
    if (!text) return;
    addMessage(this.shadowRoot, text, "assistant");
  }

  private init(): void {
    if (document.getElementById("interface-ai-root")) {
      console.log("[InterfaceAI] Overlay already exists, skipping injection");
      return;
    }

    const host = document.createElement("div");
    host.id = "interface-ai-root";
    document.body.appendChild(host);

    this.shadowRoot = host.attachShadow({ mode: "open" });

    const styleElement = document.createElement("style");
    styleElement.textContent =
      OVERLAY_STYLES + SETTINGS_STYLES + TEST_PANEL_STYLES;
    this.shadowRoot.appendChild(styleElement);

    const wrapper = document.createElement("div");
    const logoUrl = chrome.runtime.getURL("logo_128.png");
    wrapper.innerHTML = OVERLAY_HTML.replace("{{LOGO_URL}}", logoUrl);
    this.shadowRoot.appendChild(wrapper);

    this.container = this.shadowRoot.getElementById("interface-ai-main");
    this.setupEventListeners();
    this.restoreState();

    console.log("[InterfaceAI] Overlay injected successfully");
  }

  private setupEventListeners(): void {
    setupDragging(this.shadowRoot, this.container, {
      isDragging: this.isDragging,
      dragOffset: this.dragOffset,
    });

    setupResizing(this.shadowRoot, this.container, {
      isResizing: this.isResizing,
      resizeStart: this.resizeStart,
    });

    setupButtons(
      this.shadowRoot,
      this.container,
      () => this.toggleSettings(),
      () => this.toggleAgents(),
      () => this.toggleTest(),
      () => this.persistVisibility(true),
    );

    setupTestPanel(this.shadowRoot);

    setupInput(this.shadowRoot, {
      addMessage: (text, type) => addMessage(this.shadowRoot, text, type),
      showLoading: (show) => showLoading(this.shadowRoot, show),
    });

    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "OPEN_SETTINGS") {
        this.toggleSettings();
      }
    });
  }

  private hideNonTargetViews(target: "chat" | "settings" | "agents" | "test"): void {
    const chatView = this.shadowRoot?.getElementById("chat-view");
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    const agentsView = this.shadowRoot?.getElementById("agents-view");
    const testView = this.shadowRoot?.getElementById("test-view");
    if (!chatView || !settingsView || !agentsView || !testView) return;

    if (target === "chat") {
      chatView.classList.remove("hidden");
    } else {
      chatView.classList.add("hidden");
    }
    if (target === "settings") {
      settingsView.classList.remove("hidden");
    } else {
      settingsView.classList.add("hidden");
    }
    if (target === "agents") {
      agentsView.classList.remove("hidden");
    } else {
      agentsView.classList.add("hidden");
    }
    if (target === "test") {
      testView.classList.remove("hidden");
    } else {
      testView.classList.add("hidden");
    }
  }

  private toggleSettings(): void {
    const settingsView = this.shadowRoot?.getElementById("settings-view");
    if (!settingsView) return;

    if (settingsView.classList.contains("hidden")) {
      void this.openSettings();
    } else {
      this.closeToChat();
    }
  }

  private toggleAgents(): void {
    const agentsView = this.shadowRoot?.getElementById("agents-view");
    if (!agentsView) return;

    if (agentsView.classList.contains("hidden")) {
      void this.openAgents();
    } else {
      this.closeToChat();
    }
  }

  private toggleTest(): void {
    const testView = this.shadowRoot?.getElementById("test-view");
    if (!testView) return;

    if (testView.classList.contains("hidden")) {
      this.openTest();
    } else {
      this.closeToChat();
    }
  }

  private openTest(): void {
    this.hideNonTargetViews("test");
    setTimeout(() => {
      (
        this.shadowRoot?.getElementById("test-cmd-input") as HTMLInputElement
      )?.focus();
    }, 50);
  }

  private async openSettings(): Promise<void> {
    this.hideNonTargetViews("settings");
    this.authUser = await getAuthState();

    if (!this.authUser) {
      renderSignIn(this.shadowRoot, () => this.handleSignIn());
      return;
    }

    await this.loadAndRenderProfile();
  }

  private async openAgents(): Promise<void> {
    this.hideNonTargetViews("agents");
    await this.loadAndRenderAgentMemories();
  }

  private async handleSignIn(): Promise<void> {
    const settingsContent = this.shadowRoot?.getElementById("settings-content");
    if (settingsContent) {
      settingsContent.innerHTML = `
        <div class="settings-loading">
          <div class="loading-dots"><span></span><span></span><span></span></div>
          <span style="font-size: 13px; margin-top: 8px; display: block;">Signing in...</span>
        </div>
      `;
    }

    const result = await requestGoogleSignIn();
    if (result.user) {
      this.authUser = result.user;
      await this.loadAndRenderProfile();
    } else {
      renderSignIn(
        this.shadowRoot,
        () => this.handleSignIn(),
        result.error || "Sign-in failed. Please try again.",
      );
    }
  }

  private async handleSignOut(): Promise<void> {
    await requestGoogleSignOut();
    this.authUser = null;
    this.userMemories = [];
    renderSignIn(this.shadowRoot, () => this.handleSignIn());
  }

  private async loadAndRenderProfile(): Promise<void> {
    const settings = await fetchUserSettings();
    const memories = this.authUser?.userId
      ? await getCachedUserMemories(this.authUser.userId)
      : null;

    if (!settings) {
      const settingsContent =
        this.shadowRoot?.getElementById("settings-content");
      if (settingsContent) {
        settingsContent.innerHTML = `
          <div class="settings-loading">
            <span style="color: rgba(239, 68, 68, 0.8);">Failed to load settings</span>
          </div>
        `;
      }
      return;
    }

    this.userMemories = memories || [];
    renderSettings(
      this.shadowRoot,
      settings,
      this.userMemories,
      this.authUser,
      () => this.handleSignOut(),
    );

    setupSettingsListeners(
      this.shadowRoot,
      settings,
      this.userMemories,
      async (updatedSettings) => {
        await this.handleSettingsUpdate(updatedSettings);
      },
      async (fieldKey, fact) => {
        await this.handleAddMemory(fieldKey, fact);
      },
      async (memory) => {
        await this.handleDeleteMemory(memory);
      },
      async () => {
        await this.reloadUserMemories();
      },
    );
  }

  private async handleSettingsUpdate(
    updatedSettings: UserSettings,
  ): Promise<void> {
    const success = await updateUserSettings(updatedSettings);
    if (!success) return;

    renderSettings(
      this.shadowRoot,
      updatedSettings,
      this.userMemories,
      this.authUser,
      () => this.handleSignOut(),
    );
    setupSettingsListeners(
      this.shadowRoot,
      updatedSettings,
      this.userMemories,
      async (settings) => {
        await this.handleSettingsUpdate(settings);
      },
      async (fieldKey, fact) => {
        await this.handleAddMemory(fieldKey, fact);
      },
      async (memory) => {
        await this.handleDeleteMemory(memory);
      },
      async () => {
        await this.reloadUserMemories();
      },
    );
  }

  private async handleAddMemory(fieldKey: string, fact: string): Promise<void> {
    const memories = await addUserMemory(fieldKey, fact);
    if (!memories) return;
    this.userMemories = memories;
    if (this.authUser?.userId) {
      await setCachedUserMemories(this.authUser.userId, memories);
    }
    await this.loadAndRenderProfile();
  }

  private async handleDeleteMemory(memory: UserMemory): Promise<void> {
    const memories = await deleteUserMemory(memory);
    if (!memories) return;
    this.userMemories = memories;
    if (this.authUser?.userId) {
      await setCachedUserMemories(this.authUser.userId, memories);
    }
    await this.loadAndRenderProfile();
  }

  private async reloadUserMemories(): Promise<void> {
    if (!this.authUser?.userId) return;
    const memories = await fetchUserMemories();
    if (!memories) return;
    this.userMemories = memories;
    await setCachedUserMemories(this.authUser.userId, memories);
    await this.loadAndRenderProfile();
  }

  private async loadAndRenderAgentMemories(): Promise<void> {
    const cached = await getCachedAgentMemories();
    this.agentMemories = cached?.memories || [];
    this.agentId = cached?.agentId || "";
    renderAgentMemoriesPage(this.shadowRoot, this.agentMemories, this.agentId);

    const reloadBtn = this.shadowRoot?.getElementById("reload-agent-memories-btn");
    reloadBtn?.addEventListener("click", async () => {
      await this.reloadAgentMemories();
    });
  }

  private async reloadAgentMemories(): Promise<void> {
    const payload = await fetchAgentMemories();
    if (!payload) return;
    this.agentMemories = payload.memories;
    this.agentId = payload.agentId;
    await setCachedAgentMemories(payload);
    await this.loadAndRenderAgentMemories();
  }

  private closeToChat(): void {
    this.hideNonTargetViews("chat");
    this.focusInput();
  }

  public show(): void {
    this.container?.classList.remove("hidden");
    this.persistVisibility(false);
    this.notifyAgentTabActive();
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
      this.notifyAgentTabActive();
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
        this.notifyAgentTabActive();
      }
    });
  }

  private persistVisibility(hidden: boolean): void {
    chrome.storage.local.set({ [this.visibilityStorageKey]: hidden });
  }

  private focusInput(): void {
    setTimeout(() => {
      const input = this.shadowRoot?.getElementById(
        "message-input",
      ) as HTMLInputElement;
      input?.focus();
    }, 50);
  }
}
