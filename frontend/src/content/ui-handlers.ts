/**
 * UI interaction handlers (messages, loading, input)
 */

import type { ApiResponse } from "./types";
import { parseCommand, summarizeResult } from "./command-parser";

type ChatMessage = {
  text: string;
  type: "user" | "assistant" | "error";
};

type ToolStage = "call" | "approved" | "auto-approved" | "result" | "rejected";

type ToolCard = {
  action: string;
  paramsRaw: string;
  root: HTMLDetailsElement;
  meta: HTMLSpanElement;
  main: HTMLSpanElement;
  output: HTMLPreElement;
  status: "pending" | "approved" | "rejected" | "done";
};

const CHAT_STORAGE_KEY = "interface_ai_chat_messages";
const pendingToolCards: ToolCard[] = [];

function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result?.[key] as T | undefined);
    });
  });
}

function storageSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

async function appendPersistedMessage(message: ChatMessage): Promise<void> {
  const existing = (await storageGet<ChatMessage[]>(CHAT_STORAGE_KEY)) || [];
  const next = [...existing, message].slice(-100);
  await storageSet(CHAT_STORAGE_KEY, next);
}

async function clearPersistedMessages(): Promise<void> {
  await storageSet(CHAT_STORAGE_KEY, []);
}

function clearMessagesUI(shadowRoot: ShadowRoot | null): void {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;
  container.innerHTML = "";
  pendingToolCards.length = 0;
}

export async function restoreMessages(
  shadowRoot: ShadowRoot | null,
): Promise<void> {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

  const existing = (await storageGet<ChatMessage[]>(CHAT_STORAGE_KEY)) || [];
  container.innerHTML = "";
  pendingToolCards.length = 0;
  for (const msg of existing) {
    addMessage(shadowRoot, msg.text, msg.type, false);
  }
}

/**
 * Add a message to the chat container
 */
export function addMessage(
  shadowRoot: ShadowRoot | null,
  text: string,
  type: "user" | "assistant" | "error",
  persist: boolean = true,
): void {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

  const toolHandled =
    type === "assistant"
      ? renderToolEventMessage(container, text) ||
        renderUserInputEventMessage(container, text)
      : false;
  if (toolHandled) {
    if (persist) {
      appendPersistedMessage({ text, type }).catch(() => {
        // ignore storage failures
      });
    }
    container.scrollTop = container.scrollHeight;
    return;
  }

  const messageEl = document.createElement("div");
  messageEl.className = `message ${type}`;
  messageEl.textContent = text;
  container.appendChild(messageEl);

  if (persist) {
    appendPersistedMessage({ text, type }).catch(() => {
      // ignore storage failures
    });
  }

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function renderToolEventMessage(container: HTMLElement, text: string): boolean {
  const parsed = parseToolLine(text);
  if (!parsed) return false;

  if (parsed.stage === "call") {
    const card = createToolCard(parsed.action, parsed.rawPayload);
    pendingToolCards.push(card);
    container.appendChild(card.root);
    return true;
  }

  const card = findLatestPending(parsed.action, parsed.rawPayload);
  if (!card) {
    const newCard = createToolCard(parsed.action, "");
    pendingToolCards.push(newCard);
    container.appendChild(newCard.root);
    applyToolUpdate(newCard, parsed.stage, parsed.rawPayload);
    return true;
  }

  applyToolUpdate(card, parsed.stage, parsed.rawPayload);
  return true;
}

function renderUserInputEventMessage(
  container: HTMLElement,
  text: string,
): boolean {
  const parsed = parseUserInputLine(text);
  if (!parsed) return false;

  if (parsed.stage === "request") {
    const card = createToolCard("requestUserInput", parsed.rawPayload);
    card.meta.textContent = "waiting for answer";
    card.root.dataset.status = "pending";
    pendingToolCards.push(card);
    container.appendChild(card.root);
    return true;
  }

  const card = findLatestPending("requestUserInput", "");
  if (!card) {
    const newCard = createToolCard("requestUserInput", "{}");
    pendingToolCards.push(newCard);
    container.appendChild(newCard.root);
    applyToolUpdate(newCard, "result", parsed.rawPayload);
    return true;
  }

  applyToolUpdate(card, "result", parsed.rawPayload);
  return true;
}

function parseUserInputLine(
  line: string,
): { stage: "request" | "answer"; rawPayload: string } | null {
  const m = line.match(/^\[user_input:(request|answer)\]\s*(.*)$/);
  if (!m) return null;
  const [, stage, payload] = m;
  return {
    stage: stage as "request" | "answer",
    rawPayload: (payload || "").trim(),
  };
}

function parseToolLine(
  line: string,
): { stage: ToolStage; action: string; rawPayload: string } | null {
  const m = line.match(
    /^\[tool:(call|approved|auto-approved|result|rejected)\]\s+(\S+)\s*(.*)$/,
  );
  if (!m) return null;
  const [, stage, action, payload] = m;
  return {
    stage: stage as ToolStage,
    action,
    rawPayload: (payload || "").trim(),
  };
}

function findLatestPending(
  action: string,
  rawPayload: string,
): ToolCard | undefined {
  const sameAction = [...pendingToolCards]
    .reverse()
    .find((c) => c.action === action && c.status !== "done");
  if (sameAction) return sameAction;

  if (!rawPayload) return undefined;
  const samePayload = [...pendingToolCards]
    .reverse()
    .find((c) => c.paramsRaw === rawPayload && c.status !== "done");
  return samePayload;
}

function createToolCard(action: string, rawParams: string): ToolCard {
  const root = document.createElement("details");
  root.className = "message assistant tool-event";
  root.dataset.action = action;
  root.dataset.status = "pending";

  const summary = document.createElement("summary");
  summary.className = "tool-summary";
  const main = document.createElement("span");
  main.className = "tool-main";
  main.textContent = `${action} ${compactArgs(rawParams)}`.trim();

  const meta = document.createElement("span");
  meta.className = "tool-meta";
  meta.textContent = "pending";

  summary.appendChild(main);
  summary.appendChild(meta);

  const body = document.createElement("div");
  body.className = "tool-body";

  const paramsLabel = document.createElement("div");
  paramsLabel.className = "tool-label";
  paramsLabel.textContent = "params";

  const paramsPre = document.createElement("pre");
  paramsPre.className = "tool-pre";
  paramsPre.textContent = prettyPayload(rawParams || "{}");

  const outputLabel = document.createElement("div");
  outputLabel.className = "tool-label";
  outputLabel.textContent = "output";

  const outputPre = document.createElement("pre");
  outputPre.className = "tool-pre";
  outputPre.textContent = "(waiting for result)";

  body.appendChild(paramsLabel);
  body.appendChild(paramsPre);
  body.appendChild(outputLabel);
  body.appendChild(outputPre);

  root.appendChild(summary);
  root.appendChild(body);

  return {
    action,
    paramsRaw: rawParams,
    root,
    meta,
    main,
    output: outputPre,
    status: "pending",
  };
}

function applyToolUpdate(
  card: ToolCard,
  stage: ToolStage,
  rawPayload: string,
): void {
  if (stage === "auto-approved") {
    card.status = "approved";
    card.meta.textContent = "auto-approved";
    card.root.dataset.status = "auto-approved";
    return;
  }
  if (stage === "approved") {
    card.status = "approved";
    card.meta.textContent = "approved";
    card.root.dataset.status = "approved";
    return;
  }
  if (stage === "rejected") {
    card.status = "rejected";
    card.meta.textContent = "rejected";
    card.output.textContent = rawPayload
      ? prettyPayload(rawPayload)
      : "Rejected by user.";
    card.root.dataset.status = "rejected";
    card.root.open = true;
    return;
  }
  if (stage === "result") {
    const wasApproved = card.status === "approved";
    card.status = "done";
    card.meta.textContent = wasApproved
      ? `${card.meta.textContent} -> done`
      : "done";
    card.output.textContent = prettyPayload(rawPayload || "{}");
    card.root.dataset.status = "done";
    card.main.textContent =
      `${card.action} ${compactArgs(card.paramsRaw)}`.trim();
    return;
  }
}

function compactArgs(raw: string): string {
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(obj).slice(0, 2);
    if (!entries.length) return "{}";
    return entries
      .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : String(v)}`)
      .join(", ");
  } catch {
    return raw.substring(0, 80);
  }
}

function prettyPayload(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "{}";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
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
 * Setup input field and send button
 */
export function setupInput(
  shadowRoot: ShadowRoot | null,
  handlers: {
    addMessage: (text: string, type: "user" | "assistant" | "error") => void;
    showLoading: (show: boolean) => void;
  },
): void {
  const input = shadowRoot?.getElementById("message-input") as HTMLInputElement;
  const sendBtn = shadowRoot?.getElementById("send-btn");

  const sendMessage = async () => {
    const message = input?.value.trim();
    if (!message) return;

    if (message.toUpperCase() === "CLEAR") {
      input.value = "";
      handlers.showLoading(false);
      clearMessagesUI(shadowRoot);
      await clearPersistedMessages();
      return;
    }

    if (message.toLowerCase().startsWith("/command")) {
      const commandText = message.slice("/command".length).trim();
      handlers.addMessage(message, "user");
      input.value = "";

      if (!commandText) {
        handlers.addMessage(
          "Usage: /command <action>. Example: /command goto docs.google.com",
          "error",
        );
        return;
      }

      const parsed = parseCommand(commandText);
      if (parsed.kind === "screenshot") {
        const shot = await new Promise<ApiResponse>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "TAKE_SCREENSHOT" },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({
                  success: false,
                  error:
                    chrome.runtime.lastError.message || "Screenshot failed",
                });
              } else {
                resolve(
                  response || {
                    success: false,
                    error: "No response from background",
                  },
                );
              }
            },
          );
        });

        if (!shot.success) {
          handlers.addMessage(
            `Command failed: ${shot.error || "unknown error"}`,
            "error",
          );
          return;
        }
        handlers.addMessage("Command OK: Screenshot captured", "assistant");
        return;
      }

      const actionResponse = await new Promise<ApiResponse>((resolve) => {
        chrome.runtime.sendMessage(
          { type: "EXECUTE_ACTION", payload: parsed.action },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error: chrome.runtime.lastError.message || "Command failed",
              });
            } else {
              resolve(
                response || { success: false, error: "No response from tab" },
              );
            }
          },
        );
      });

      if (!actionResponse.success) {
        handlers.addMessage(
          `Command failed: ${actionResponse.error || "unknown error"}`,
          "error",
        );
        return;
      }

      const actionData = (actionResponse.data as Record<string, unknown>) || {};
      const wasSuccess = actionData.success !== false;
      if (!wasSuccess) {
        handlers.addMessage(
          `Command failed: ${String(actionData.error || "unknown error")}`,
          "error",
        );
        return;
      }

      handlers.addMessage(
        `Command OK: ${summarizeResult(actionData)}`,
        "assistant",
      );
      return;
    }

    handlers.addMessage(message, "user");
    input.value = "";
    handlers.showLoading(true);

    try {
      const BACKEND_API = "http://localhost:5000";
      const url = `${BACKEND_API}/api/relay`;
      const isStreamingGoal =
        message.toUpperCase().startsWith("GOAL:") &&
        Boolean(message.split(":", 2)[1]?.trim());

      if (!isStreamingGoal) {
        const once = await fetch(`${BACKEND_API}/api/relay_once`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (!once.ok) {
          throw new Error(`HTTP ${once.status}`);
        }

        const data = (await once.json()) as { message?: string; done?: boolean };
        handlers.showLoading(false);
        if (typeof data.message === "string" && data.message) {
          handlers.addMessage(data.message, "assistant");
        }
        return;
      }

      // Use fetch with streaming (handles CORS better than EventSource)
      const response = await fetch(
        `${url}?message=${encodeURIComponent(message)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let firstMessage = true;
      let sseBuffer = "";
      let sawDone = false;

      if (!reader) {
        throw new Error("No response body");
      }

      // Read the stream
      while (!sawDone) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode the chunk
        sseBuffer += decoder.decode(value, { stream: true });

        // Parse complete SSE events separated by blank lines.
        const parsed = consumeSseEvents(sseBuffer);
        sseBuffer = parsed.remainder;

        for (const data of parsed.events) {
          if (firstMessage) {
            handlers.showLoading(false);
            firstMessage = false;
          }

          if (typeof data.message === "string" && data.message) {
            handlers.addMessage(data.message, "assistant");
          }
          if (data.done === true) {
            sawDone = true;
            break;
          }
        }
      }

      if (!sawDone && sseBuffer.trim()) {
        const parsed = consumeSseEvents(`${sseBuffer}\n\n`);
        for (const data of parsed.events) {
          if (firstMessage) {
            handlers.showLoading(false);
            firstMessage = false;
          }
          if (typeof data.message === "string" && data.message) {
            handlers.addMessage(data.message, "assistant");
          }
          if (data.done === true) {
            sawDone = true;
            break;
          }
        }
      }

      if (sawDone) {
        try {
          await reader.cancel();
        } catch {
          // Ignore reader cancellation errors.
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

function consumeSseEvents(buffer: string): {
  events: Array<Record<string, unknown>>;
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const remainder = normalized.endsWith("\n\n") ? "" : (blocks.pop() ?? "");
  const events: Array<Record<string, unknown>> = [];

  for (const block of blocks) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6));

    if (!dataLines.length) continue;

    try {
      events.push(JSON.parse(dataLines.join("\n")) as Record<string, unknown>);
    } catch {
      // Ignore malformed event payloads.
    }
  }

  return { events, remainder };
}

/**
 * Setup close button, settings button, and test button
 */
export function setupButtons(
  shadowRoot: ShadowRoot | null,
  container: HTMLElement | null,
  onSettingsClick?: () => void,
  onTestClick?: () => void,
  onCloseClick?: () => void,
): void {
  const closeBtn = shadowRoot?.getElementById("close-btn");
  closeBtn?.addEventListener("click", () => {
    container?.classList.add("hidden");
    if (onCloseClick) onCloseClick();
  });

  const settingsBtn = shadowRoot?.getElementById("settings-btn");
  settingsBtn?.addEventListener("click", () => {
    if (onSettingsClick) onSettingsClick();
  });

  const testBtn = shadowRoot?.getElementById("test-btn");
  testBtn?.addEventListener("click", () => {
    if (onTestClick) onTestClick();
  });
}
