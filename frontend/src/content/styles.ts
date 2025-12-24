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
    color: #1a1a2e;
    resize: both;
    overflow: hidden;
  }

  .interface-ai-container .glass-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: inherit;
  }

  /* Glassmorphic Panel */
  .glass-panel {
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.1),
      0 2px 8px rgba(0, 0, 0, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
    overflow: hidden;
  }

  /* Header with drag handle */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.15);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    cursor: grab;
    user-select: none;
  }

  .header:active {
    cursor: grabbing;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 15px;
  }

  .header-title svg {
    width: 20px;
    height: 20px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
    color: inherit;
  }

  .icon-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .icon-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Content area */
  .content {
    padding: 16px;
    flex: 1;
    overflow-y: auto;
    min-height: 60px;
  }

  .content::-webkit-scrollbar {
    width: 6px;
  }

  .content::-webkit-scrollbar-track {
    background: transparent;
  }

  .content::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .message {
    margin-bottom: 12px;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
  }

  .message.assistant {
    background: rgba(99, 102, 241, 0.15);
    border-left: 3px solid rgba(99, 102, 241, 0.6);
  }

  .message.user {
    background: rgba(34, 197, 94, 0.15);
    border-left: 3px solid rgba(34, 197, 94, 0.6);
  }

  .message.error {
    background: rgba(239, 68, 68, 0.15);
    border-left: 3px solid rgba(239, 68, 68, 0.6);
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(99, 102, 241, 0.8);
    font-size: 13px;
  }

  .loading-dots {
    display: flex;
    gap: 4px;
  }

  .loading-dots span {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
  .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  /* Input area */
  .input-area {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    gap: 8px;
  }

  .input-area input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    color: inherit;
  }

  .input-area input:focus {
    border-color: rgba(99, 102, 241, 0.5);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .input-area input::placeholder {
    color: rgba(0, 0, 0, 0.4);
  }

  .send-btn {
    padding: 10px 16px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .send-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .send-btn:active {
    transform: translateY(0);
  }

  .send-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* Hidden state */
  .interface-ai-container.hidden {
    display: none;
  }

  /* Resize handle styling */
  .interface-ai-container::-webkit-resizer {
    background: transparent;
  }

  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .resize-handle:hover {
    opacity: 1;
  }

  .resize-handle svg {
    width: 12px;
    height: 12px;
    color: inherit;
  }

  /* When resizing, prevent text selection */
  .interface-ai-container.resizing {
    user-select: none;
  }

  .interface-ai-container.resizing * {
    pointer-events: none;
  }
`;
