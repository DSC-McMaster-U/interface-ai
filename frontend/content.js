// Content script - runs on web pages to execute automation steps
console.log("InterfaceAI content script loaded");

// Listen for messages from the popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "executeSteps") {
    executeSteps(message.steps)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === "executeStep") {
    executeStep(message.step)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // async
  }
});

// Execute automation steps sequentially
async function executeSteps(steps) {
  console.log("Starting execution of steps:", steps);
  const results = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`Executing step ${i + 1}:`, step);
    
    try {
      const result = await executeStep(step);
      results.push({ step: i + 1, success: true, result });
      
      // Wait a bit between steps
      await sleep(1000);
    } catch (error) {
      console.error(`Error executing step ${i + 1}:`, error);
      results.push({ step: i + 1, success: false, error: error.message });
      throw error; // Stop execution on error
    }
  }
  
  return results;
}

// Execute a single step
async function executeStep(step) {
  const action = step.action.toLowerCase();
  
  switch (action) {
    case "navigate":
      return await navigateToUrl(step.value || step.target);
    
    case "click":
      return await clickElement(step.target);
    
    case "type":
      return await typeInElement(step.target, step.value);
    
    case "wait":
      return await sleep(parseInt(step.value) * 1000 || 2000);
    
    case "scroll":
      return await scrollPage(step.target);

    case "search":
      return await performSearch(step.target, step.value);

    case "ask_user":
      return await showUserPrompt(step);
    
    default:
      console.warn(`Unknown action: ${action}`);
      throw new Error(`Unknown action: ${action}`);
  }
}

// Show an in-page prompt asking the user for more info
// Supports specialized flows for flight and pizza preferences
async function showUserPrompt(step) {
  const key = (step.value || "").toLowerCase();
  const message = step.description || step.value || "The agent needs more information.";

  if (key === "flight_preferences") {
    return await showFlightPreferencesPrompt(message);
  }
  if (key === "pizza_preferences") {
    return await showPizzaPreferencesPrompt(message);
  }

  // Generic single-question prompt with free-text answer
  const existing = document.getElementById("interfaceai-user-prompt");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "interfaceai-user-prompt";
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 360px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    padding: 16px;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: #111827;
  `;

  overlay.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px; color: #4f46e5;">InterfaceAI needs more info</div>
    <div style="margin-bottom: 8px; line-height: 1.4;">${message}</div>
    <textarea id="interfaceai-user-input" style="
      width: 100%;
      min-height: 60px;
      margin-bottom: 10px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      font-family: inherit;
      font-size: 13px;
      resize: vertical;
    " placeholder="Type your answer here..."></textarea>
    <button id="interfaceai-user-prompt-ok" style="
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: none;
      background: #4f46e5;
      color: white;
      font-weight: 600;
      cursor: pointer;
    ">Send to agent</button>
  `;

  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    document.getElementById("interfaceai-user-prompt-ok").addEventListener("click", () => {
      const inputEl = document.getElementById("interfaceai-user-input");
      const text = (inputEl && inputEl.value || "").trim();

      // Simple acknowledgement toast
      const ack = document.createElement("div");
      ack.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 260px;
        background: #ecfdf5;
        color: #065f46;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        padding: 10px 14px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
      `;
      ack.textContent = text
        ? "Got it — I’ll use that information in the next steps."
        : "Got it — proceeding with what I have.";

      overlay.remove();
      document.body.appendChild(ack);

      setTimeout(() => {
        ack.remove();
      }, 2500);

      resolve({
        message: "User provided additional info",
        user_input: text,
      });
    });
  });
}

// Specialized multi-question prompt for flights
async function showFlightPreferencesPrompt(message) {
  const existing = document.getElementById("interfaceai-user-prompt");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "interfaceai-user-prompt";
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 380px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    padding: 16px 18px;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: #111827;
  `;

  overlay.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 8px; color: #4f46e5;">Flight preferences</div>
    <div style="margin-bottom: 8px; line-height: 1.5;">${message}</div>
    <div style="margin-bottom: 8px;">
      <div style="font-weight: 600; margin-bottom: 4px;">Price vs speed</div>
      <label style="display:block; margin-bottom:4px;"><input type="radio" name="ia-price-pref" value="cheapest" checked> Prefer the cheapest flights</label>
      <label style="display:block; margin-bottom:4px;"><input type="radio" name="ia-price-pref" value="fastest"> Prefer the fastest flights</label>
      <label style="display:block;"><input type="radio" name="ia-price-pref" value="none"> No strong preference</label>
    </div>
    <div style="margin-bottom: 8px;">
      <label><input type="checkbox" id="ia-direct-only"> Direct flights only (no stops)</label>
    </div>
    <button id="interfaceai-user-prompt-ok" style="
      width: 100%;
      padding: 8px 12px;
      border-radius: 10px;
      border: none;
      background: #4f46e5;
      color: white;
      font-weight: 600;
      cursor: pointer;
    ">Continue</button>
  `;

  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    document.getElementById("interfaceai-user-prompt-ok").addEventListener("click", () => {
      const radios = overlay.querySelectorAll("input[name='ia-price-pref']");
      let pricePref = "none";
      radios.forEach((r) => { if (r.checked) pricePref = r.value; });
      const directOnly = overlay.querySelector("#ia-direct-only").checked;

      const summary = `Preferences: ${pricePref === 'cheapest' ? 'cheapest flights' : pricePref === 'fastest' ? 'fastest flights' : 'no strong preference'}, ` +
        (directOnly ? "direct flights only." : "stops are okay.");

      // Acknowledge
      const ack = document.createElement("div");
      ack.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 260px;
        background: #ecfdf5;
        color: #065f46;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        padding: 10px 14px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
      `;
      ack.textContent = `Got it — ${summary}`;

      overlay.remove();
      document.body.appendChild(ack);

      setTimeout(() => {
        ack.remove();
      }, 2500);

      resolve({
        message: "User provided flight preferences",
        user_input: {
          price_preference: pricePref,
          direct_only: directOnly,
        },
      });
    });
  });
}

// Specialized multi-question prompt for pizza/Dominos
async function showPizzaPreferencesPrompt(message) {
  const existing = document.getElementById("interfaceai-user-prompt");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "interfaceai-user-prompt";
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 380px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    padding: 16px 18px;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: #111827;
  `;

  overlay.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 8px; color: #4f46e5;">Dominos order details</div>
    <div style="margin-bottom: 8px; line-height: 1.5;">${message}</div>
    <div style="margin-bottom: 6px; font-weight: 600;">1) What pizza do you want?</div>
    <input id="ia-pizza-main" style="width:100%; margin-bottom:8px; padding:6px 8px; border-radius:8px; border:1px solid #e5e7eb; font-size:13px;" placeholder="e.g., Large pepperoni, thin crust" />
    <div style="margin-bottom: 6px; font-weight: 600;">2) Any sides or drinks?</div>
    <input id="ia-pizza-sides" style="width:100%; margin-bottom:8px; padding:6px 8px; border-radius:8px; border:1px solid #e5e7eb; font-size:13px;" placeholder="e.g., Garlic bread, Coke" />
    <button id="interfaceai-user-prompt-ok" style="
      width: 100%;
      padding: 8px 12px;
      border-radius: 10px;
      border: none;
      background: #4f46e5;
      color: white;
      font-weight: 600;
      cursor: pointer;
    ">Continue</button>
  `;

  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    document.getElementById("interfaceai-user-prompt-ok").addEventListener("click", () => {
      const main = (document.getElementById("ia-pizza-main").value || "").trim();
      const sides = (document.getElementById("ia-pizza-sides").value || "").trim();

      const summary = `Pizza: ${main || 'not specified'}; Sides/drinks: ${sides || 'none'}.`;

      const ack = document.createElement("div");
      ack.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        max-width: 260px;
        background: #ecfdf5;
        color: #065f46;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        padding: 10px 14px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
      `;
      ack.textContent = `Got it — ${summary}`;

      overlay.remove();
      document.body.appendChild(ack);

      setTimeout(() => {
        ack.remove();
      }, 2500);

      resolve({
        message: "User provided pizza preferences",
        user_input: {
          pizza: main,
          sides_drinks: sides,
        },
      });
    });
  });
}

// Perform a web search (typically on Google)
async function performSearch(target, query) {
  const q = (query || target || "").toString().trim();
  if (!q) {
    return { message: "No search query provided" };
  }

  let url;
  const targetLower = (target || "").toLowerCase();
  if (targetLower.includes("google")) {
    url = "https://www.google.com/search?q=" + encodeURIComponent(q);
  } else {
    // Default to Google search
    url = "https://www.google.com/search?q=" + encodeURIComponent(q);
  }

  window.location.href = url;
  return { message: `Searching the web for: ${q}` };
}

// Navigate to URL
async function navigateToUrl(url) {
  // Add protocol if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  
  window.location.href = url;
  return { message: `Navigating to ${url}` };
}

// Click an element
async function clickElement(selector) {
  const element = findElement(selector);
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Scroll element into view
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(500);
  
  // Highlight the element briefly
  highlightElement(element);
  
  // Click it
  element.click();
  
  return { message: `Clicked element: ${selector}` };
}

// Type into an element
async function typeInElement(selector, text) {
  const element = findElement(selector);
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Scroll element into view
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(500);
  
  // Highlight the element
  highlightElement(element);
  
  // Focus and clear
  element.focus();
  element.value = "";
  
  // Type character by character (more natural)
  for (let char of text) {
    element.value += char;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(50);
  }
  
  // Trigger change event
  element.dispatchEvent(new Event("change", { bubbles: true }));
  
  return { message: `Typed "${text}" into ${selector}` };
}

// Find element using various strategies
function findElement(selector) {
  // Try direct querySelector
  let element = document.querySelector(selector);
  if (element) return element;
  
  // Try finding by placeholder
  if (selector.includes("placeholder")) {
    const match = selector.match(/placeholder[*^$]?=['"]([^'"]+)['"]/);
    if (match) {
      element = document.querySelector(`[placeholder*="${match[1]}"]`);
      if (element) return element;
    }
  }
  
  // Try finding by aria-label
  if (selector.includes("aria-label")) {
    const match = selector.match(/aria-label[*^$]?=['"]([^'"]+)['"]/);
    if (match) {
      element = document.querySelector(`[aria-label*="${match[1]}"]`);
      if (element) return element;
    }
  }
  
  // Try finding by text content for buttons/links
  if (selector.includes("button") || selector.includes("link")) {
    const match = selector.match(/['"]([^'"]+)['"]/);
    if (match) {
      const text = match[1].toLowerCase();
      element = Array.from(document.querySelectorAll("button, a")).find(
        el => el.textContent.toLowerCase().includes(text)
      );
      if (element) return element;
    }
  }
  
  return null;
}

// Scroll the page
async function scrollPage(direction) {
  const scrollAmount = direction === "down" ? 500 : -500;
  window.scrollBy({ top: scrollAmount, behavior: "smooth" });
  return { message: `Scrolled ${direction}` };
}

// Highlight an element temporarily
function highlightElement(element) {
  const originalOutline = element.style.outline;
  const originalBackgroundColor = element.style.backgroundColor;
  
  element.style.outline = "3px solid #667eea";
  element.style.backgroundColor = "rgba(102, 126, 234, 0.1)";
  
  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.backgroundColor = originalBackgroundColor;
  }, 1500);
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
