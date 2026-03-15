/**
 * Styles for the glassmorphic overlay
 * Injected into Shadow DOM for style isolation
 */
export const OVERLAY_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :host {
    --glass-bg: rgba(20, 20, 20, 0.85);
    --glass-border: rgba(255, 255, 255, 0.1);
    --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    --text-primary: #ffffff;
    --text-secondary: #a1a1aa;
    --accent-color: #ffffff;
    --danger-color: #ef4444;
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .interface-ai-container {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 360px;
    height: 500px;
    min-width: 280px;
    max-width: 90vw;
    min-height: 150px;
    max-height: 90vh;
    z-index: 2147483647;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-primary);
    filter: drop-shadow(0 20px 40px rgba(0,0,0,0.3));
    transition: width 0.2s, height 0.2s;
  }

  /* Glass Panel */
  .glass-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--glass-bg);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    cursor: grab;
    user-select: none;
    background: rgba(255,255,255,0.02);
  }

  .header:active {
    cursor: grabbing;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    font-size: 14px;
    color: var(--text-primary);
    opacity: 0.9;
    letter-spacing: 0.2px;
  }

  .header-logo {
    display: flex;
    align-items: center;
  }

  .header-logo img {
    width: 22px;
    height: 22px;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    color: var(--text-secondary);
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .icon-btn svg {
    width: 16px;
    height: 16px;
    stroke-width: 2px;
  }

  /* Content area */
  .content {
    padding: 20px;
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .content::-webkit-scrollbar {
    width: 4px;
  }

  .content::-webkit-scrollbar-track {
    background: transparent;
  }

  .content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  .content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .message {
    max-width: 90%;
    padding: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary);
    animation: fadeIn 0.3s ease;
    min-width: 0;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* User Message */
  .message.user {
    align-self: flex-end;
    background: rgba(255, 255, 255, 0.1);
    padding: 10px 16px;
    border-radius: 18px 18px 4px 18px;
    font-weight: 400;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Assistant Message */
  .message.assistant {
    align-self: flex-start;
    background: transparent;
    padding: 0;
    padding-right: 12px;
    color: #e4e4e7;
  }

  .message.error {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .tool-event {
    align-self: stretch;
    width: 100%;
    max-width: none;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0;
    overflow: hidden;
    padding-right: 0;
    flex: 0 0 auto;
  }

  .tool-event[open] {
    background: rgba(255, 255, 255, 0.055);
    resize: vertical;
    overflow: auto;
    min-height: 120px;
    max-height: 70vh;
  }

  .tool-event[data-status="rejected"] {
    border-color: rgba(239, 68, 68, 0.35);
  }

  .tool-event[data-status="approved"],
  .tool-event[data-status="auto-approved"],
  .tool-event[data-status="done"] {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .tool-summary {
    list-style: none;
    cursor: pointer;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: #f4f4f5;
    font-size: 12px;
    min-width: 0;
    user-select: none;
  }

  .tool-summary::-webkit-details-marker {
    display: none;
  }

  .tool-main {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .tool-meta {
    flex: 0 0 auto;
    color: #a1a1aa;
    font-size: 11px;
    white-space: nowrap;
  }

  .tool-body {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding: 8px 10px;
    display: grid;
    gap: 6px;
    background: rgba(0, 0, 0, 0.18);
    min-width: 0;
  }

  .tool-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #a1a1aa;
  }

  .tool-pre {
    margin: 0;
    padding: 8px;
    min-height: 88px;
    max-height: 320px;
    overflow: auto;
    resize: vertical;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.25);
    color: #e4e4e7;
    font-size: 11px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  /* Input area */
  .input-area {
    padding: 16px;
    background: rgba(0,0,0,0.2);
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-area input {
    width: 100%;
    padding: 12px 16px;
    padding-right: 40px; /* Space for send button if inside */
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.3);
    font-size: 14px;
    outline: none;
    transition: all 0.2s ease;
    color: var(--text-primary);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
  }

  .input-area input:focus {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.5);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.1);
  }

  .input-area input::placeholder {
    color: #555;
  }

  .send-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: white;
    color: black;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    position: absolute;
    right: 8px;
    opacity: 0.9;
  }

  .send-btn:hover {
    transform: scale(1.05);
    opacity: 1;
    background: white;
    box-shadow: 0 0 10px rgba(255,255,255,0.2);
  }

  .send-btn svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 2.5;
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: default;
    transform: none;
    background: #555;
    color: #888;
  }

  /* Loading State */
  .loading {
    padding: 0 4px;
    opacity: 0.6;
  }

  .loading-dots {
    display: flex;
    gap: 4px;
  }

  .loading-dots span {
    width: 6px;
    height: 6px;
    background: var(--text-primary);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
  .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Resize Handle */
  .resize-handle {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    opacity: 0.3;
    transition: opacity 0.2s;
    pointer-events: auto;
  }

  .resize-handle:hover {
    opacity: 1;
  }
  
  .resize-handle svg {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Utilities */
  .hidden {
    display: none !important;
  }
`;
