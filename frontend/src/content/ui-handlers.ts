/**
 * UI interaction handlers (messages, loading, input)
 */

import type { ApiRequestMessage, ApiResponse } from "./types";

/**
 * Add a message to the chat container
 */
export function addMessage(
  shadowRoot: ShadowRoot | null,
  text: string,
  type: "user" | "assistant" | "error",
): void {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

  const messageEl = document.createElement("div");
  messageEl.className = `message ${type}`;
  messageEl.textContent = text;
  container.appendChild(messageEl);

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Show or hide loading indicator
 */
export function showLoading(
  shadowRoot: ShadowRoot | null,
  show: boolean,
): void {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

  // Remove existing loading indicator
  const existing = container.querySelector(".loading");
  if (existing) existing.remove();

  if (show) {
    const loadingEl = document.createElement("div");
    loadingEl.className = "loading";
    loadingEl.innerHTML = `
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span>Thinking...</span>
    `;
    container.appendChild(loadingEl);
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Send a message to the background script
 */
export function sendToBackground(
  message: ApiRequestMessage,
): Promise<ApiResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: ApiResponse) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: chrome.runtime.lastError.message || "Communication error",
        });
      } else {
        resolve(
          response || { success: false, error: "No response from background" },
        );
      }
    });
  });
}

/**
 * Setup input field and send button
 */
export function setupInput(
  shadowRoot: ShadowRoot | null,
  handlers: {
    addMessage: (text: string, type: "user" | "assistant" | "error") => void;
    showLoading: (show: boolean) => void;
    sendToBackground: (message: ApiRequestMessage) => Promise<ApiResponse>;
  },
): void {
  const input = shadowRoot?.getElementById("message-input") as HTMLInputElement;
  const sendBtn = shadowRoot?.getElementById("send-btn");

  const sendMessage = async () => {
    const message = input?.value.trim();
    if (!message) return;

    handlers.addMessage(message, "user");
    input.value = "";
    handlers.showLoading(true);

    try {
      const BACKEND_API = "http://localhost:5000";
      const url = `${BACKEND_API}/api/relay`;
      
      // Use fetch with streaming (handles CORS better than EventSource)
      const response = await fetch(`${url}?message=${encodeURIComponent(message)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let firstMessage = true;

      if (!reader) {
        throw new Error("No response body");
      }

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        
        // Parse SSE lines (format: "data: {...}\n\n")
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6); // Remove "data: " prefix
            try {
              const data = JSON.parse(jsonStr);
              
              // Remove loading on first message
              if (firstMessage) {
                handlers.showLoading(false);
                firstMessage = false;
              }

              if (data.message) {
                handlers.addMessage(data.message, "assistant");
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // Make sure loading is hidden
      handlers.showLoading(false);

    } catch (error) {
      handlers.showLoading(false);
      handlers.addMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  };

  sendBtn?.addEventListener("click", sendMessage);
  input?.addEventListener("keypress", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Prevent keyboard events from bubbling to the host page
  if (input) {
    const stopPropagation = (e: Event) => e.stopPropagation();
    input.addEventListener("keydown", stopPropagation);
    input.addEventListener("keyup", stopPropagation);
    input.addEventListener("keypress", stopPropagation);
    input.addEventListener("input", stopPropagation);
    input.addEventListener("focus", stopPropagation);
    input.addEventListener("blur", stopPropagation);
  }
}

/**
 * Setup close button and settings button
 */
export function setupButtons(
  shadowRoot: ShadowRoot | null,
  container: HTMLElement | null,
  onSettingsClick?: () => void,
): void {
  const closeBtn = shadowRoot?.getElementById("close-btn");
  closeBtn?.addEventListener("click", () => {
    container?.classList.add("hidden");
  });

  const settingsBtn = shadowRoot?.getElementById("settings-btn");
  settingsBtn?.addEventListener("click", () => {
    if (onSettingsClick) {
      onSettingsClick();
    }
  });
}
