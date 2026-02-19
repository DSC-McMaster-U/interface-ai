/**
 * HTML template for the overlay UI
 */
export const OVERLAY_HTML = `
  <div class="interface-ai-container hidden" id="interface-ai-main">
    <div class="glass-panel">
      <!-- Header -->
      <div class="header" id="drag-handle">
        <div class="header-title">
          InterfaceAI
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="settings-btn" title="Settings">
            <!-- Settings Icon (Gear) -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="icon-btn" id="close-btn" title="Close">
            <!-- Close Icon (X) -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Chat View -->
      <div class="chat-view" id="chat-view">
        <div class="content" id="messages-container">
          <div class="message assistant">
            Hello! I'm InterfaceAI. How can I assist you?
          </div>
        </div>
        <div class="input-area">
          <div class="input-wrapper">
            <input type="text" id="message-input" placeholder="Ask anything..." />
            <button class="send-btn" id="send-btn" title="Send">
               <!-- Arrow Up Icon -->
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Settings View -->
      <div class="settings-view hidden" id="settings-view">
        <div class="settings-header" style="padding: 20px; padding-bottom: 10px;">
          <h2 style="font-size: 18px; font-weight: 600;">Settings</h2>
        </div>
        <div class="content" id="settings-content" style="padding-top: 0;">
          <div class="settings-loading">
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span style="font-size: 13px; margin-top: 8px; display: block;">Loading settings...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Resize Handle -->
    <div class="resize-handle" id="resize-handle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 22L12 22M22 22L22 12M22 22L15 15"></path>
      </svg>
    </div>
  </div>
`;
