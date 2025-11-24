// Autonomous Executor - Enhanced execution with vision and intelligent navigation
console.log("InterfaceAI Autonomous Executor loaded");

const AUTONOMOUS_API_BASE = "http://localhost:5001";
let sessionId = `session_${Date.now()}`;

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "executeAutonomous") {
    executeAutonomousFlow(message.intent)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open
  }
  
  if (message.action === "extractFlights") {
    extractFlightResults()
      .then(flights => sendResponse({ success: true, flights }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === "takeScreenshot") {
    takeAndAnalyzeScreenshot(message.context)
      .then(analysis => sendResponse({ success: true, analysis }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Main autonomous execution flow
async function executeAutonomousFlow(intent) {
  console.log("Starting autonomous flow for:", intent);
  
  try {
    // Ask the user for basic flight preferences before planning
    const prefsText = await askUserFlightPreferences();
    const intentWithPrefs = prefsText ? `${intent}. ${prefsText}` : intent;

    // Step 1: Get navigation plan from backend
    const planResponse = await fetch(`${AUTONOMOUS_API_BASE}/api/flight/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: intentWithPrefs, session_id: sessionId })
    });
    
    if (!planResponse.ok) throw new Error("Failed to get navigation plan");
    
    const plan = await planResponse.json();
    console.log("Navigation plan:", plan);
    
    // Step 2: Execute navigation steps
    const steps = plan.navigation_plan || [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`Executing step ${i + 1}/${steps.length}:`, step);
      
      // Show progress to user
      showProgress(`Step ${i + 1}/${steps.length}: ${step.description}`);
      
      await executeStepIntelligently(step);
      
      // Wait between steps
      await sleep(1500);
    }
    
    // Step 3: Extract flight results
    showProgress("Extracting flight options...");
    await sleep(3000); // Wait for results to fully load
    
    const flights = await extractFlightResults();
    
    // Step 4: Send to backend for analysis
    const optionsResponse = await fetch(`${AUTONOMOUS_API_BASE}/api/flight/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId })
    });
    
    const options = await optionsResponse.json();
    
    // Step 5: Show options to user
    showFlightOptions(options);
    
    return { status: "completed", flights: options.options };
    
  } catch (error) {
    console.error("Autonomous flow error:", error);
    showError(error.message);
    throw error;
  }
}

// Execute a single step intelligently
async function executeStepIntelligently(step) {
  const action = step.action.toLowerCase();
  
  if (action === "navigate") {
    // Navigation handled by background script
    window.location.href = ensureProtocol(step.value || step.target);
    await waitForPageLoad();
    return;
  }
  
  // For other actions, get intelligent element selector
  const elementInfo = await getElementInfo(step.target);
  
  if (action === "click") {
    await clickElementWithRetry(elementInfo, step);
  } else if (action === "type") {
    await typeInElementWithRetry(elementInfo, step);
  } else if (action === "wait") {
    await sleep(parseInt(step.value) || 2000);
  } else if (action === "extract_results") {
    // Will be handled separately
    return;
  } else if (action === "analyze_page") {
    const analysis = await takeAndAnalyzeScreenshot(step.description);
    console.log("Page analysis:", analysis);
  }
}

// Get intelligent element selector from backend
async function getElementInfo(target) {
  try {
    const response = await fetch(`${API_BASE}/api/page/element`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        page_html: document.documentElement.outerHTML.substring(0, 10000)
      })
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn("Failed to get element info from backend:", e);
  }
  
  // Fallback
  return {
    primary_selector: target,
    alternatives: [],
    confidence: 0.5
  };
}

// Click element with multiple selector strategies
async function clickElementWithRetry(elementInfo, step) {
  const selectors = [
    elementInfo.primary_selector,
    ...(elementInfo.alternatives || [])
  ];
  
  for (const selector of selectors) {
    const element = findElement(selector);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(500);
      
      highlightElement(element);
      element.click();
      
      console.log(`Clicked element with selector: ${selector}`);
      return true;
    }
  }
  
  throw new Error(`Could not find element: ${step.target}`);
}

// Type in element with multiple selector strategies
async function typeInElementWithRetry(elementInfo, step) {
  const selectors = [
    elementInfo.primary_selector,
    ...(elementInfo.alternatives || [])
  ];
  
  for (const selector of selectors) {
    const element = findElement(selector);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(500);
      
      highlightElement(element);
      element.focus();
      element.value = "";
      
      // Type character by character
      const text = step.value || "";
      for (let char of text) {
        element.value += char;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(50);
      }
      
      element.dispatchEvent(new Event("change", { bubbles: true }));
      
      console.log(`Typed "${text}" into element with selector: ${selector}`);
      
      // Wait for suggestions dropdown if applicable
      await sleep(1000);
      
      return true;
    }
  }
  
  throw new Error(`Could not find element: ${step.target}`);
}

// Extract flight results from current page
async function extractFlightResults() {
  // Try multiple selectors for flight cards
  const cardSelectors = [
    ".flight-result",
    "[data-testid*='flight']",
    ".result-item",
    "li[role='listitem']",
    ".gws-flights__best-flights li",
    ".gws-flights-results__result-item"
  ];
  
  let cards = [];
  for (const sel of cardSelectors) {
    cards = Array.from(document.querySelectorAll(sel));
    if (cards.length > 0) {
      console.log(`Found ${cards.length} flight cards with selector: ${sel}`);
      break;
    }
  }
  
  // Extract flight data
  const flights = [];
  cards.slice(0, 10).forEach((card, idx) => {
    const price = card.textContent.match(/\$[0-9,]+/)?.[0] || "";
    const times = card.textContent.match(/\d{1,2}:\d{2}\s*[AP]M/gi) || [];
    
    flights.push({
      id: `flight_${idx}`,
      price: price,
      departure_time: times[0] || "TBD",
      arrival_time: times[1] || "TBD",
      airline: extractAirline(card),
      duration: extractDuration(card),
      stops: extractStops(card),
      html_snippet: card.innerHTML.substring(0, 500)
    });
  });
  
  // Send to backend for processing
  await fetch(`${AUTONOMOUS_API_BASE}/api/flight/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      page_content: document.body.textContent,
      screenshot_analysis: null
    })
  });
  
  return flights;
}

// Helper to extract airline name
function extractAirline(card) {
  const airlineSelectors = [
    "[data-test*='airline']",
    ".airline",
    ".carrier-name",
    "img[alt*='Airlines']"
  ];
  
  for (const sel of airlineSelectors) {
    const el = card.querySelector(sel);
    if (el) {
      return el.textContent?.trim() || el.alt || "";
    }
  }
  
  return "Unknown";
}

// Helper to extract duration
function extractDuration(card) {
  const durationMatch = card.textContent.match(/(\d+)\s*h\s*(\d+)?\s*m?/i);
  if (durationMatch) {
    return `${durationMatch[1]}h ${durationMatch[2] || 0}m`;
  }
  return "N/A";
}

// Helper to extract number of stops
function extractStops(card) {
  const text = card.textContent.toLowerCase();
  if (text.includes("nonstop") || text.includes("direct")) {
    return 0;
  }
  const stopsMatch = text.match(/(\d+)\s*stop/);
  if (stopsMatch) {
    return parseInt(stopsMatch[1]);
  }
  return 1;
}

// Take screenshot and analyze with vision AI
async function takeAndAnalyzeScreenshot(context) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "captureScreenshot", context },
      (response) => {
        if (response && response.analysis) {
          resolve(response.analysis);
        } else {
          resolve({ error: "Failed to analyze screenshot" });
        }
      }
    );
  });
}

// Show progress overlay
function showProgress(message) {
  let overlay = document.getElementById("interfaceai-progress");
  
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "interfaceai-progress";
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      min-width: 200px;
    `;
    document.body.appendChild(overlay);
  }
  
  overlay.textContent = message;
}

// Show flight options to user
function showFlightOptions(options) {
  const overlay = document.createElement("div");
  overlay.id = "interfaceai-options";
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    z-index: 1000000;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  
  let html = `
    <h2 style="margin: 0 0 16px 0; color: #667eea;">Found Flight Options</h2>
    <p style="margin: 0 0 20px 0; color: #666;">${options.recommendation || ""}</p>
  `;
  
  options.options?.forEach((flight, idx) => {
    html += `
      <div style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        cursor: pointer;
      " data-flight-id="${flight.id}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; font-size: 16px; color: #111;">${flight.airline || "Unknown Airline"}</div>
            <div style="color: #666; font-size: 14px; margin-top: 4px;">
              ${flight.departure_time} - ${flight.arrival_time}
              ${flight.stops === 0 ? " · Direct" : ` · ${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </div>
            ${flight.duration ? `<div style="color: #999; font-size: 12px;">${flight.duration}</div>` : ""}
          </div>
          <div style="font-size: 20px; font-weight: 700; color: #667eea;">${flight.price}</div>
        </div>
      </div>
    `;
  });
  
  html += `
    <button id="interfaceai-close" style="
      width: 100%;
      padding: 12px;
      background: #e5e7eb;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 12px;
    ">Close</button>
  `;
  
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  
  // Add click handlers
  document.getElementById("interfaceai-close").addEventListener("click", () => {
    overlay.remove();
  });
  
  options.options?.forEach((flight) => {
    const card = overlay.querySelector(`[data-flight-id="${flight.id}"]`);
    if (card) {
      card.addEventListener("click", () => selectFlight(flight.id));
    }
  });
}

// User selects a flight
async function selectFlight(flightId) {
  const response = await fetch(`${AUTONOMOUS_API_BASE}/api/flight/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, flight_id: flightId })
  });
  
  const result = await response.json();
  
  alert(`Selected flight! ${result.message}`);
  
  // Try to open the airline's official site in a new tab based on the selected flight
  const airline = result.flight?.airline || "";
  if (airline) {
    const query = `${airline} official site flights`;
    const url = "https://www.google.com/search?q=" + encodeURIComponent(query);
    window.open(url, "_blank");
  }
  
  // Close options overlay
  document.getElementById("interfaceai-options")?.remove();
}

// Show error message
function showError(message) {
  const overlay = document.getElementById("interfaceai-progress");
  if (overlay) {
    overlay.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
    overlay.textContent = `❌ Error: ${message}`;
    
    setTimeout(() => overlay.remove(), 5000);
  }
}

// Find element using various strategies
function findElement(selector) {
  try {
    let element = document.querySelector(selector);
    if (element && element.offsetParent !== null) return element;
    
    // Try with :visible filter
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.find(el => el.offsetParent !== null);
  } catch (e) {
    return null;
  }
}

// Highlight element
function highlightElement(element) {
  const originalOutline = element.style.outline;
  element.style.outline = "3px solid #667eea";
  setTimeout(() => {
    element.style.outline = originalOutline;
  }, 1500);
}

// Ensure URL has protocol
function ensureProtocol(url) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return "https://" + url;
  }
  return url;
}

// Simple in-page questionnaire for flight preferences
async function askUserFlightPreferences() {
  // Create overlay if not present
  let overlay = document.getElementById("interfaceai-flight-prefs");
  if (overlay) {
    overlay.remove();
  }

  overlay = document.createElement("div");
  overlay.id = "interfaceai-flight-prefs";
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 360px;
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
    <div style="margin-bottom: 12px; line-height: 1.5;">
      Before I search, how should I choose flights?
    </div>
    <div style="margin-bottom: 8px;">
      <div style="font-weight: 600; margin-bottom: 4px;">Price vs speed</div>
      <label style="display:block; margin-bottom:4px;"><input type="radio" name="ia-price-pref" value="cheapest" checked> Prefer the cheapest flights</label>
      <label style="display:block; margin-bottom:4px;"><input type="radio" name="ia-price-pref" value="fastest"> Prefer the fastest flights</label>
      <label style="display:block;"><input type="radio" name="ia-price-pref" value="none"> No strong preference</label>
    </div>
    <div style="margin-bottom: 12px;">
      <label><input type="checkbox" id="ia-direct-only"> Direct flights only (no stops)</label>
    </div>
    <button id="ia-flight-prefs-continue" style="
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
    document.getElementById("ia-flight-prefs-continue").addEventListener("click", () => {
      const radios = overlay.querySelectorAll("input[name='ia-price-pref']");
      let pricePref = "none";
      radios.forEach((r) => { if (r.checked) pricePref = r.value; });
      const directOnly = overlay.querySelector("#ia-direct-only").checked;

      let descParts = [];
      if (pricePref === "cheapest") descParts.push("User prefers the cheapest flights.");
      else if (pricePref === "fastest") descParts.push("User prefers the fastest flights.");
      else descParts.push("User has no strong price vs speed preference.");

      if (directOnly) descParts.push("User only wants direct flights with no stops.");
      else descParts.push("User is okay with flights that have stops.");

      overlay.remove();
      resolve(descParts.join(" "));
    });
  });
}

// Wait for page load
function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      window.addEventListener("load", resolve);
    }
  });
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
