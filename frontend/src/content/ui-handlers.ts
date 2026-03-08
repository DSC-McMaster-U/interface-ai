/**
 * UI interaction handlers (messages, loading, input)
 */

import type { ApiRequestMessage, ApiResponse, ChatApiResponse } from "./types";
import { executeAction, describeAction } from "./actions";
import type { ActionType, ActionResult } from "./actions";

// -------------------- MESSAGE HELPERS --------------------

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
  container.scrollTop = container.scrollHeight;
}

function addActionMessage(
  shadowRoot: ShadowRoot | null,
  text: string,
  success: boolean,
): void {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

  const messageEl = document.createElement("div");
  messageEl.className = "message action-status";
  messageEl.setAttribute(
    "style",
    `font-size: 12px; color: ${success ? "rgba(161,161,170,0.8)" : "rgba(239,68,68,0.8)"}; padding: 2px 0; align-self: flex-start;`,
  );
  messageEl.textContent = `${success ? ">" : "!"} ${text}`;
  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;
}

function addImageMessage(shadowRoot: ShadowRoot | null, dataUrl: string): void {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

  const wrapper = document.createElement("div");
  wrapper.className = "message assistant";

  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText =
    "max-width:100%;border-radius:6px;margin-top:4px;display:block;";
  img.alt = "Page screenshot";

  wrapper.appendChild(img);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

// -------------------- ACTION RUNNER --------------------

async function runActions(
  shadowRoot: ShadowRoot | null,
  actions: ActionType[],
): Promise<void> {
  for (const action of actions) {
    const label = describeAction(action);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const result = executeAction(action);
      const ok = "success" in result ? (result.success as boolean) : true;
      const detail = !ok && "error" in result ? ` — ${result.error}` : "";
      addActionMessage(shadowRoot, `${label}${detail}`, ok);
    } catch (err) {
      addActionMessage(
        shadowRoot,
        `${label} — ${err instanceof Error ? err.message : "failed"}`,
        false,
      );
    }
  }
}

// -------------------- COMMAND PARSER --------------------

const HELP_TEXT = `Available commands:
/click <name>            — click button or link by text
/fill <field> <value>    — fill an input by name/label
/type <text>             — type text into the focused element
/enter [field]           — press Enter (on active or named field)
/scroll up [px]          — scroll up (default 500px)
/scroll down [px]        — scroll down (default 500px)
/scroll top              — scroll to top
/scroll bottom           — scroll to bottom
/goto <url>              — navigate to URL
/coord <x> <y>           — click at screen coordinates
/result                  — click first search result
/status                  — show page info
/screenshot              — take a screenshot of the current page
/help                    — show this list

Chain commands by separating with ", ":
  /fill search computers, /enter search`;

import { getPageStatus } from "./actions";
import {
  clickAtCoordinate,
  clickByName,
  clickFirstSearchResult,
  scrollUp,
  scrollDown,
  scrollToTop,
  scrollToBottom,
  fillInput,
  pressEnter,
  pressEnterOn,
  typeText,
} from "./actions";
import type { PageStatus } from "./actions";

function formatStatus(s: PageStatus): string {
  const lines: string[] = [
    `Page: ${s.title}`,
    `URL: ${s.url}`,
    `Scroll: ${s.scroll.percent}% (${s.scroll.position}px / ${s.scroll.maxScroll}px)`,
  ];
  if (s.headings.length)
    lines.push(
      `Headings: ${s.headings
        .slice(0, 5)
        .map((h) => `[${h.level}] ${h.text}`)
        .join(", ")}`,
    );
  if (s.buttons.length)
    lines.push(
      `Buttons: ${s.buttons
        .slice(0, 6)
        .map((b) => b.text || "(no label)")
        .join(", ")}`,
    );
  if (s.textboxes.length)
    lines.push(
      `Inputs: ${s.textboxes
        .slice(0, 6)
        .map((i) => i.name)
        .join(", ")}`,
    );
  if (s.links.length)
    lines.push(
      `Links: ${s.links
        .slice(0, 5)
        .map((l) => l.text || l.href)
        .join(", ")}`,
    );
  return lines.join("\n");
}

async function handleCommand(
  shadowRoot: ShadowRoot | null,
  raw: string,
  addMsg: (text: string, type: "user" | "assistant" | "error") => void,
  ctx: { lastFilledField?: string } = {},
): Promise<boolean> {
  if (!raw.startsWith("/")) return false;

  const [cmd, ...argParts] = raw.slice(1).trim().split(/\s+/);
  const args = argParts.join(" ");

  const ok = (text: string) => addMsg(text, "assistant");
  const fail = (text: string) => addMsg(text, "error");
  const report = (result: ActionResult, label: string) => {
    if (result.success) {
      ok(label);
    } else {
      fail(`${label} — ${result.error ?? "failed"}`);
    }
  };

  switch (cmd.toLowerCase()) {
    case "help":
      ok(HELP_TEXT);
      return true;

    case "status": {
      const s = getPageStatus();
      ok(formatStatus(s));
      return true;
    }

    case "click": {
      if (!args) {
        fail("Usage: /click <name>");
        return true;
      }
      report(clickByName(args), `Click "${args}"`);
      return true;
    }

    case "fill": {
      if (!argParts[0] || argParts.length < 2) {
        fail("Usage: /fill <field> <value>");
        return true;
      }
      const field = argParts[0];
      const value = argParts.slice(1).join(" ");
      ctx.lastFilledField = field;
      report(fillInput(field, value), `Fill "${field}" with "${value}"`);
      return true;
    }

    case "type": {
      if (!args) {
        fail("Usage: /type <text>");
        return true;
      }
      report(typeText(args), `Type "${args}"`);
      return true;
    }

    case "enter": {
      const target = args || ctx.lastFilledField;
      if (target) {
        report(pressEnterOn(target), `Press Enter on "${target}"`);
      } else {
        report(pressEnter(), "Press Enter");
      }
      return true;
    }

    case "scroll": {
      const dir = argParts[0]?.toLowerCase();
      const px = argParts[1] ? parseInt(argParts[1], 10) : undefined;
      if (dir === "up") {
        report(scrollUp(px), `Scroll up${px ? ` ${px}px` : ""}`);
      } else if (dir === "down") {
        report(scrollDown(px), `Scroll down${px ? ` ${px}px` : ""}`);
      } else if (dir === "top") {
        report(scrollToTop(), "Scroll to top");
      } else if (dir === "bottom") {
        report(scrollToBottom(), "Scroll to bottom");
      } else {
        fail("Usage: /scroll up|down|top|bottom [px]");
      }
      return true;
    }

    case "goto": {
      if (!args) {
        fail("Usage: /goto <url>");
        return true;
      }
      const url = args.startsWith("http") ? args : `https://${args}`;
      ok(`Navigating to ${url}`);
      setTimeout(() => {
        window.location.href = url;
      }, 300);
      return true;
    }

    case "coord": {
      const x = parseFloat(argParts[0]);
      const y = parseFloat(argParts[1]);
      if (isNaN(x) || isNaN(y)) {
        fail("Usage: /coord <x> <y>");
        return true;
      }
      report(clickAtCoordinate(x, y), `Click at (${x}, ${y})`);
      return true;
    }

    case "result": {
      report(clickFirstSearchResult(), "Click first search result");
      return true;
    }

    case "screenshot": {
      addMsg("Taking screenshot...", "assistant");
      const response = await new Promise<{
        success: boolean;
        data?: string;
        error?: string;
      }>((resolve) =>
        chrome.runtime.sendMessage({ type: "TAKE_SCREENSHOT" }, resolve),
      );
      if (response?.success && response.data) {
        addImageMessage(shadowRoot, response.data);
      } else {
        fail(`Screenshot failed — ${response?.error ?? "unknown error"}`);
      }
      return true;
    }

    default:
      fail(`Unknown command: /${cmd}  —  type /help to see available commands`);
      return true;
  }
}

// -------------------- LOADING --------------------

export function showLoading(
  shadowRoot: ShadowRoot | null,
  show: boolean,
): void {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

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

// -------------------- BACKGROUND RELAY --------------------

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

// -------------------- INPUT SETUP --------------------

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

    // Handle slash commands locally — supports chaining with ", /"
    if (message.startsWith("/")) {
      const parts = message.split(/,\s*(?=\/)/);
      const ctx: { lastFilledField?: string } = {};
      for (const part of parts) {
        await handleCommand(shadowRoot, part.trim(), handlers.addMessage, ctx);
        if (parts.length > 1) await new Promise((r) => setTimeout(r, 200));
      }
      return;
    }

    // Fall through to backend API for regular chat messages
    handlers.showLoading(true);

    try {
      const response = await handlers.sendToBackground({
        type: "API_REQUEST",
        payload: {
          endpoint: "/api/relay",
          method: "POST",
          body: { message },
        },
      });

      handlers.showLoading(false);

      if (response.success) {
        const data = response.data as ChatApiResponse;
        const replyText = data.message || data.echo || "Message received";
        handlers.addMessage(replyText, "assistant");

        if (Array.isArray(data.actions) && data.actions.length > 0) {
          await runActions(shadowRoot, data.actions);
        }
      } else {
        handlers.addMessage(`Error: ${response.error}`, "error");
      }
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
    if (e.key === "Enter") sendMessage();
  });

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

// -------------------- BUTTONS --------------------

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
    if (onSettingsClick) onSettingsClick();
  });
}
