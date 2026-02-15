/**
 * Test Panel - DOM automation UI
 * Same functionality as action-execution/test-extension popup.
 * Sends commands via chrome.runtime to background → automation.js.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionResult = Record<string, any>;

function sendCommand(
  action: string,
  params: Record<string, unknown>,
  callback: (result: ActionResult) => void,
): void {
  chrome.runtime.sendMessage(
    { target: "background", action, params },
    (result: ActionResult) => {
      if (chrome.runtime.lastError) {
        callback({ success: false, error: chrome.runtime.lastError?.message });
      } else {
        callback(result || { success: false, error: "No response" });
      }
    },
  );
}

export const TEST_PANEL_STYLES = `
  .test-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .test-view.hidden {
    display: none;
  }

  .test-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }

  .test-quick-btn {
    flex-shrink: 0;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px;
    color: rgba(0, 0, 0, 0.7);
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .test-quick-btn:hover {
    background: rgba(255, 255, 255, 0.35);
    border-color: rgba(99, 102, 241, 0.5);
    color: #1a1a2e;
  }

  .test-log-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    min-height: 80px;
  }

  .test-log-area::-webkit-scrollbar {
    width: 6px;
  }

  .test-log-area::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .test-log-entry {
    padding: 8px 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .test-log-entry:last-child {
    border-bottom: none;
  }

  .test-log-entry .cmd {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: rgba(99, 102, 241, 0.9);
    margin-bottom: 2px;
  }

  .test-log-entry .result {
    font-size: 12px;
    line-height: 1.4;
  }

  .test-log-entry .result.ok {
    color: rgba(34, 197, 94, 0.9);
  }

  .test-log-entry .result.err {
    color: rgba(239, 68, 68, 0.9);
  }

  .test-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 120px;
    color: rgba(0, 0, 0, 0.5);
    font-size: 13px;
    gap: 6px;
  }

  .test-input-bar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
  }

  .test-input-bar input {
    flex: 1;
    padding: 9px 12px;
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 10px;
    color: #1a1a2e;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12.5px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .test-input-bar input:focus {
    border-color: rgba(99, 102, 241, 0.5);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .test-input-bar input::placeholder {
    color: rgba(0, 0, 0, 0.4);
  }

  .test-run-btn {
    padding: 9px 14px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .test-run-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .test-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .test-status-dot.connected {
    background: rgba(34, 197, 94, 0.9);
  }

  .test-status-dot.disconnected {
    background: rgba(239, 68, 68, 0.9);
  }
`;

interface ParsedCommand {
  action: string;
  params: Record<string, unknown>;
}

function parseCommand(raw: string): ParsedCommand {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? "";

  switch (cmd) {
    case "click": {
      const x = parseFloat(parts[1] ?? "");
      const y = parseFloat(parts[2] ?? "");
      if (!isNaN(x) && !isNaN(y))
        return { action: "clickAtCoordinate", params: { x, y } };
      return { action: "clickByName", params: { name: parts.slice(1).join(" ") } };
    }
    case "fill":
      return {
        action: "fillInput",
        params: { identifier: parts[1], value: parts.slice(2).join(" ") },
      };
    case "type":
      return { action: "typeText", params: { text: parts.slice(1).join(" ") } };
    case "enter":
      return { action: "pressEnter", params: {} };
    case "key":
      return { action: "pressKey", params: { key: parts.slice(1).join(" ") } };
    case "scroll": {
      const dir = (parts[1] || "down").toLowerCase();
      const px = parseInt(parts[2] ?? "", 10) || undefined;
      if (dir === "up") return { action: "scrollUp", params: { pixels: px } };
      if (dir === "top") return { action: "scrollToTop", params: {} };
      if (dir === "bottom")
        return { action: "scrollToBottom", params: {} };
      return { action: "scrollDown", params: { pixels: px } };
    }
    case "goto":
    case "go":
      return { action: "goto", params: { url: parts.slice(1).join(" ") } };
    case "back":
      return { action: "goBack", params: {} };
    case "forward":
      return { action: "goForward", params: {} };
    case "status":
      return { action: "getPageStatus", params: {} };
    case "screenshot":
      return { action: "screenshot", params: {} };
    case "result":
    case "first":
      return { action: "clickFirstSearchResult", params: {} };
    default:
      return { action: "clickByName", params: { name: raw.trim() } };
  }
}

function summarize(obj: ActionResult): string {
  if ("dataUrl" in obj && obj.dataUrl) return "Screenshot captured";
  if ("title" in obj && obj.title && "url" in obj && obj.url && "scroll" in obj) {
    const parts = ['Page: "' + obj.title + '"'];
    const nLinks = (obj.links as unknown[] | undefined)?.length ?? 0;
    const nBtns = (obj.buttons as unknown[] | undefined)?.length ?? 0;
    parts.push(`${nLinks} links`, `${nBtns} buttons`);
    const fillable = (obj.fillableFields as unknown[] | undefined)?.length;
    if (fillable) parts.push(`${fillable} fillable`);
    const search = (obj.searchBoxes as unknown[] | undefined)?.length;
    if (search) parts.push(`${search} search`);
    return parts.join(" | ");
  }
  if ("title" in obj && obj.title && "url" in obj && obj.url)
    return 'Page: "' + obj.title + '"';
  if ("text" in obj && obj.text) return obj.text as string;
  if ("url" in obj && obj.url) return obj.url as string;
  if ("name" in obj && obj.name) return "Field: " + obj.name;
  if ("scrolledBy" in obj && obj.scrolledBy != null)
    return "Scrolled " + obj.scrolledBy + "px";
  return JSON.stringify(obj).substring(0, 120);
}

function escHtml(str: string): string {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

export function setupTestPanel(shadowRoot: ShadowRoot | null): void {
  const logArea = shadowRoot?.getElementById("test-log");
  const cmdInput = shadowRoot?.getElementById("test-cmd-input") as HTMLInputElement;
  const runBtn = shadowRoot?.getElementById("test-run-btn");
  const statusDot = shadowRoot?.getElementById("test-status-dot");
  let hasEntries = false;

  function addLog(cmd: string, text: string, isOk: boolean): void {
    if (!logArea) return;
    if (!hasEntries) {
      logArea.innerHTML = "";
      hasEntries = true;
    }
    const entry = document.createElement("div");
    entry.className = "test-log-entry";
    entry.innerHTML =
      '<div class="cmd">&gt; ' +
      escHtml(cmd) +
      '</div><div class="result ' +
      (isOk ? "ok" : "err") +
      '">' +
      (isOk ? "✓ " : "✗ ") +
      escHtml(text) +
      "</div>";
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
  }

  function run(): void {
    const raw = cmdInput?.value.trim();
    if (!raw) return;

    const parsed = parseCommand(raw);
    if (cmdInput) cmdInput.value = "";
    cmdInput?.focus();

    sendCommand(parsed.action, parsed.params, (result) => {
      const isOk = result.success !== false;
      const text = result.error || summarize(result);
      addLog(raw, text, isOk);
      if (parsed.action === "getPageStatus" && result.success !== false) {
        console.log("[InterfaceAI] Page status (full hashmap):", result);
      }
      console.log("[InterfaceAI] Command:", parsed.action, parsed.params);
      console.log("[InterfaceAI] Result:", result);
    });
  }

  runBtn?.addEventListener("click", run);
  cmdInput?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") run();
  });

  shadowRoot?.querySelectorAll(".test-quick-btn").forEach((btn) => {
    const el = btn as HTMLElement;
    el.addEventListener("click", () => {
      const cmd = el.getAttribute("data-cmd");
      const prefill = el.getAttribute("data-prefill");
      if (prefill != null) {
        if (cmdInput) {
          cmdInput.value = prefill;
          cmdInput.focus();
        }
        return;
      }
      if (cmd && cmdInput) {
        cmdInput.value = cmd;
        run();
      }
    });
  });

  // Connection check (ping via automation.js)
  if (statusDot) {
    sendCommand("ping", {}, (result) => {
      if (result.success !== false) {
        statusDot.className = "test-status-dot connected";
        statusDot.title = "Connected";
      } else {
        statusDot.className = "test-status-dot disconnected";
        statusDot.title = "Not connected — refresh the tab";
      }
    });
  }
}
