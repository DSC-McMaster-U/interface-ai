const fs = require('fs');
let code = fs.readFileSync('frontend/src/content/ui-handlers.ts', 'utf8');

code = code.replace(
  /if \(typeof data\.message === "string" && data\.message\) {\s*handlers\.addMessage\(data\.message, "assistant"\);\s*}/g,
  \// data.message is sent via WebSocket agent_log to survive navigations.\\n            // if (typeof data.message === "string" && data.message) { handlers.addMessage(data.message, "assistant"); }\
);

let isRestoring = \let isRestoring = true;
const queuedPreRestore: { shadowRoot: ShadowRoot | null, text: string, type: "user" | "assistant" | "error" }[] = [];

export async function restoreMessages(
  shadowRoot: ShadowRoot | null,
): Promise<void> {
  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;

  const existing = (await storageGet<ChatMessage[]>(CHAT_STORAGE_KEY)) || [];
  container.innerHTML = "";
  pendingToolCards.length = 0;
  for (const msg of existing) {
    addMessage(shadowRoot, msg.text, msg.type, false, true);
  }
  
  isRestoring = false;
  for (const q of queuedPreRestore) {
    addMessage(q.shadowRoot, q.text, q.type, true, false);
  }
  queuedPreRestore.length = 0;
}

// -------------------- MESSAGE HELPERS --------------------

/**
 * Add a message to the chat container
 */
export function addMessage(
  shadowRoot: ShadowRoot | null,
  text: string,
  type: "user" | "assistant" | "error",
  persist: boolean = true,
  isRestorePass: boolean = false,
): void {
  if (isRestoring && !isRestorePass) {
    queuedPreRestore.push({ shadowRoot, text, type });
    return;
  }

  const container = shadowRoot?.getElementById("messages-container");
  if (!container) return;\;

code = code.replace(
  /export async function restoreMessages[\\s\\S]*?if \(!container\) return;/m,
  isRestoring
);

fs.writeFileSync('frontend/src/content/ui-handlers.ts', code);
