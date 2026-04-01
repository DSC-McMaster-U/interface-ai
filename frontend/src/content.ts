/**
 * Content Script - Main entry point
 * Injects overlay and provides a WebSocket bridge for backend agent commands.
 */

import { InterfaceAIOverlay } from "./content/overlay";
import { executeAction } from "./content/actions";
import type { ExecuteActionMessage } from "./content/types";

const overlay = new InterfaceAIOverlay();

let ws: WebSocket | null = null;
let reconnectDelayMs = 2000;
let wsEnabled = false;

function sendWsMessage(payload: Record<string, unknown>): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

async function handleWsMessage(raw: string): Promise<void> {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  if (msg.type === "agent_log") {
    overlay.appendAgentLog(String(msg.message || ""));
    return;
  }

  const id = Number(msg.id);
  const action = String(msg.action || "");
  const params = (msg.params || {}) as Record<string, unknown>;

  if (!action || !Number.isFinite(id)) {
    return;
  }

  let result: Record<string, unknown>;
  try {
    result = (await executeAction({
      type: action,
      ...(params || {}),
    } as never)) as unknown as Record<string, unknown>;
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "Action failed",
    };
  }

  sendWsMessage({ type: "result", id, result });
}

function connectAgentWebSocket(): void {
  if (!wsEnabled || ws) return;
  try {
    ws = new WebSocket("ws://localhost:7878");

    ws.onopen = () => {
      reconnectDelayMs = 2000;
      sendWsMessage({
        type: "connected",
        title: document.title,
        url: window.location.href,
      });
    };

    ws.onmessage = (event) => {
      handleWsMessage(String(event.data || ""));
    };

    ws.onclose = () => {
      ws = null;
      if (!wsEnabled) return;
      window.setTimeout(connectAgentWebSocket, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10000);
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };
  } catch {
    window.setTimeout(connectAgentWebSocket, reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10000);
  }
}

function closeAgentWebSocket(): void {
  if (!ws) return;
  try {
    ws.onclose = null;
    ws.close();
  } catch {
    // ignore close errors
  }
  ws = null;
}

function setAgentWsEnabled(enabled: boolean): void {
  wsEnabled = enabled;
  if (enabled) {
    connectAgentWebSocket();
  } else {
    closeAgentWebSocket();
  }
}

chrome.runtime.sendMessage({ type: "GET_AGENT_WS_STATE" }, (response) => {
  const enabled = Boolean(
    response?.success &&
    (response.data as { enabled?: boolean } | undefined)?.enabled,
  );
  setAgentWsEnabled(enabled);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AGENT_WS_STATE") {
    setAgentWsEnabled(Boolean(message.enabled));
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "TOGGLE_OVERLAY") {
    overlay.toggle();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "EXECUTE_ACTION") {
    const { payload } = message as ExecuteActionMessage;
    executeAction(payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) =>
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : "Action failed",
        }),
      );
    return true;
  }

  return true;
});
