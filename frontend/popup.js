const API_BASE = "http://localhost:5001";
const API_STEPS = `${API_BASE}/api/create-steps`;
const API_HEALTH = `${API_BASE}/health`;

// Ensure our content scripts are present in the active tab
async function ensureContentScripts(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js", "autonomous_executor.js"],
    });
  } catch (e) {
    console.warn("Failed to inject content scripts:", e);
  }
}

// Check backend health on load
async function checkBackend() {
  const statusEl = document.getElementById("status");
  try {
    const res = await fetch(API_HEALTH);
    if (res.ok) {
      statusEl.textContent = "✓ Connected to backend";
      statusEl.className = "status online";
      return true;
    }
  } catch (e) {
    statusEl.textContent = "✗ Backend offline - Start Flask server";
    statusEl.className = "status offline";
    return false;
  }
}

// Main entry: generate steps from intent; user then chooses when to run them
async function executeIntent() {
  const intentInput = document.getElementById("intent");
  const outputDiv = document.getElementById("output");
  const executeBtn = document.getElementById("executeIntent");
  
  const intent = intentInput.value.trim();
  
  if (!intent) {
    outputDiv.innerHTML = '<div class="error">Please enter what you want to do</div>';
    outputDiv.classList.add("visible");
    return;
  }
  
  // Show loading state
  executeBtn.disabled = true;
  executeBtn.textContent = "⚙️ Planning...";
  outputDiv.innerHTML = '<div class="loading">🤖 Thinking through the best steps...</div>';
  outputDiv.classList.add("visible");
  
  try {
    // First, generate steps from backend
    let steps = await generateStepsForIntent(intent);

    // Inject mandatory conversation steps for certain intents
    steps = injectConversationSteps(intent, steps);
    if (!steps || !steps.length) {
      throw new Error("No steps generated");
    }

    // Display the plan in the popup; user will click a second button to run it
    displaySteps(steps);

  } catch (e) {
    outputDiv.innerHTML = `<div class="error">❌ Error: ${e.message}<br><small>Make sure Flask backend is running</small></div>`;
  } finally {
    executeBtn.disabled = false;
    executeBtn.textContent = "🚀 Execute Task";
  }
}

// Call backend to generate steps for an intent
async function generateStepsForIntent(intent) {
  const res = await fetch(API_STEPS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent })
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.steps || data.steps.length === 0) {
    throw new Error("No steps generated");
  }

  lastGeneratedSteps = data.steps;
  return data.steps;
}

// (Legacy) Generate steps from user intent and just display them (not used by main button now)
async function generateSteps() {
  const intentInput = document.getElementById("intent");
  const outputDiv = document.getElementById("output");
  const generateBtn = document.getElementById("executeIntent");
  
  const intent = intentInput.value.trim();
  
  if (!intent) {
    outputDiv.innerHTML = '<div class="error">Please enter what you want to do</div>';
    outputDiv.classList.add("visible");
    return;
  }
  
  // Show loading state
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  outputDiv.innerHTML = '<div class="loading">🤖 Thinking...</div>';
  outputDiv.classList.add("visible");
  
  try {
    const res = await fetch(API_STEPS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent })
    });
    
    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.steps || data.steps.length === 0) {
      throw new Error("No steps generated");
    }
    
    // Display steps
    displaySteps(data.steps);
    
  } catch (e) {
    outputDiv.innerHTML = `<div class="error">❌ Error: ${e.message}<br><small>Make sure Flask backend is running</small></div>`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Steps";
  }
}

// Store the last generated steps
let lastGeneratedSteps = [];

// Display steps in a nice format
function displaySteps(steps) {
  const outputDiv = document.getElementById("output");
  lastGeneratedSteps = steps; // Store for execution
  
  let html = '<div style="margin-bottom: 12px; font-weight: 600; color: #667eea;">Generated Steps:</div>';
  
  steps.forEach((step, index) => {
    const actionIcon = getActionIcon(step.action);
    html += `
      <div class="step-item">
        <div class="step-number">Step ${index + 1} ${actionIcon}</div>
        <div class="step-action">${step.action.toUpperCase()}: ${step.target}</div>
        ${step.value ? `<div class="step-description">Value: "${step.value}"</div>` : ''}
        <div class="step-description">${step.description}</div>
      </div>
    `;
  });

  // Add a second button so user can choose when to run the plan
  html += `
    <button id="executePlanBtn" style="
      width: 100%;
      margin-top: 16px;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    ">▶ Run This Plan</button>
  `;
  
  outputDiv.innerHTML = html;
  outputDiv.classList.add("visible");

  const executePlanBtn = document.getElementById("executePlanBtn");
  if (executePlanBtn) {
    executePlanBtn.addEventListener("click", async () => {
      executePlanBtn.disabled = true;
      executePlanBtn.textContent = "⚙️ Executing...";
      await executeStepsInActiveTab(lastGeneratedSteps, outputDiv);
      executePlanBtn.disabled = false;
      executePlanBtn.textContent = "▶ Run This Plan";
    });
  }
}

// Execute the given steps on the active tab using the background orchestrator
async function executeStepsInActiveTab(steps, outputDiv) {
  if (!steps || !steps.length) {
    outputDiv.innerHTML = '<div class="error">No steps to execute</div>';
    return;
  }

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id || !tab.url || !tab.url.startsWith("http")) {
    outputDiv.innerHTML = '<div class="error">❌ Error: Open any normal website (http/https) and then run the task.</div>';
    return;
  }

  // Make sure content scripts are injected
  await ensureContentScripts(tab.id);

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "startExecution",
        steps,
        tabId: tab.id,
      },
      (response) => {
        if (!response) {
          outputDiv.innerHTML = '<div class="error">❌ Execution failed: no response from background</div>';
          resolve();
          return;
        }
        if (response.success) {
          outputDiv.innerHTML = '<div style="color: #10b981; font-weight: 600; padding: 16px; text-align: center;">✅ Execution completed! Check the page for what the agent did and any questions it asked.</div>';
        } else {
          outputDiv.innerHTML = `<div class="error">❌ Execution failed: ${response.error || 'Unknown error'}</div>`;
        }
        resolve();
      }
    );
  });
}

// Inject mandatory ask_user-style steps so the agent always converses with the user
function injectConversationSteps(intent, steps) {
  const intentLower = intent.toLowerCase();
  const hasAskUser = steps.some(s => (s.action || "").toLowerCase() === "ask_user");

  // For flights, if we don't already have an ask_user step, add one near the start
  if (!hasAskUser && intentLower.includes("flight")) {
    steps = [
      {
        action: "ask_user",
        target: "",
        value: "flight_preferences",
        description:
          "Before I search flights, are you looking for the cheapest options, the fastest options, and do you want only direct flights or are stops okay?",
      },
      ...steps,
    ];
  }

  // For Dominos/food orders, ensure we ask what to order
  if (!hasAskUser && (intentLower.includes("dominos") || intentLower.includes("domino's") || intentLower.includes("pizza"))) {
    steps = [
      {
        action: "ask_user",
        target: "",
        value: "pizza_preferences",
        description:
          "What would you like to order from Dominos? Please include size, toppings, crust, and any sides or drinks.",
      },
      ...steps,
    ];
  }

  return steps;
}

// Get emoji icon for action type
function getActionIcon(action) {
  const icons = {
    navigate: '🌐',
    click: '👆',
    type: '⌨️',
    search: '🔍',
    wait: '⏳',
    scroll: '📜',
    analyze: '🔬'
  };
  return icons[action.toLowerCase()] || '▶️';
}

// Event listeners
const executeBtn = document.getElementById("executeIntent");
if (executeBtn) {
  executeBtn.addEventListener("click", executeIntent);
}

document.getElementById("intent").addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    executeIntent();
  }
});

// Check backend on load
checkBackend();
