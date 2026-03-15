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

function sendWsMessage(payload: Record<string, unknown>): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function handleWsMessage(raw: string): void {
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
    result = executeAction({
      type: action,
      ...(params || {}),
    } as never) as Record<string, unknown>;
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "Action failed",
    };
  }

  sendWsMessage({ type: "result", id, result });
}

function connectAgentWebSocket(): void {
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

connectAgentWebSocket();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TOGGLE_OVERLAY") {
    overlay.toggle();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "EXECUTE_ACTION") {
    const { payload } = message as ExecuteActionMessage;
    try {
      const result = executeAction(payload);
      sendResponse({ success: true, data: result });
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : "Action failed",
      });
    }
    return true;
  }

  return true;
});
