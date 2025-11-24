// Utility function to send messages to content script
async function sendToContentScript(action, data) {
  const out = document.getElementById("out");

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      out.textContent = "Error: No active tab found";
      out.style.color = "#f44336";
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { action, ...data },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Popup] Error:", chrome.runtime.lastError.message);
          out.textContent = `Error: ${chrome.runtime.lastError.message}\n(Try refreshing the page)`;
          out.style.color = "#f44336";
          return;
        }

        if (response && response.success) {
          out.textContent = `✅ ${response.message}`;
          out.style.color = "#4CAF50";
          console.log("[Popup] Success:", response);
        } else {
          out.textContent = `❌ ${response?.message || "Action failed"}`;
          out.style.color = "#f44336";
          console.warn("[Popup] Failed:", response);
        }
      }
    );
  } catch (e) {
    console.error("[Popup] Error:", e);
    out.textContent = `Error: ${e.message}`;
    out.style.color = "#f44336";
  }
}

// Click button action
async function clickButton() {
  const input = document.getElementById("msg");
  const out = document.getElementById("out");
  const buttonText = input.value.trim();

  if (!buttonText) {
    out.textContent = "Please enter button text";
    out.style.color = "#f44336";
    return;
  }

  out.textContent = "Clicking button...";
  out.style.color = "";
  console.log(`[Popup] Clicking button: "${buttonText}"`);

  await sendToContentScript("clickButton", { buttonText });
}

// Fill textbox action
async function fillTextbox() {
  const input = document.getElementById("msg");
  const out = document.getElementById("out");
  const value = input.value.trim();

  if (!value) {
    out.textContent = "Enter: field_name|text_to_fill";
    out.style.color = "#f44336";
    return;
  }

  // Parse input: "email|test@test.com"
  const parts = value.split("|");
  if (parts.length !== 2) {
    out.textContent = "Format: field_name|text (e.g., email|test@test.com)";
    out.style.color = "#f44336";
    return;
  }

  const [fieldName, textToFill] = parts.map((s) => s.trim());

  out.textContent = "Filling textbox...";
  out.style.color = "";
  console.log(`[Popup] Filling "${fieldName}" with "${textToFill}"`);

  await sendToContentScript("fillTextbox", { fieldName, textToFill });
}

// Search Google and click first result
async function searchGoogle() {
  const input = document.getElementById("msg");
  const out = document.getElementById("out");
  const query = input.value.trim();

  if (!query) {
    out.textContent = "Please enter search query";
    out.style.color = "#f44336";
    return;
  }

  out.textContent = "Searching Google...";
  out.style.color = "";
  console.log(`[Popup] Searching Google for: "${query}"`);

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      out.textContent = "Error: No active tab found";
      out.style.color = "#f44336";
      return;
    }

    // Navigate to Google search
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await chrome.tabs.update(tabs[0].id, { url: searchUrl });

    out.textContent = "Navigating to Google...";

    // Wait for page to load, then click first result
    setTimeout(async () => {
      await sendToContentScript("clickFirstSearchResult", {});
    }, 3000); // Wait 3 seconds for Google to load
  } catch (e) {
    console.error("[Popup] Error:", e);
    out.textContent = `Error: ${e.message}`;
    out.style.color = "#f44336";
  }
}

// Full Auto - AI generates steps
let generatedSteps = [];
let currentStepIndex = 0;
let currentAlternativeIndex = 0;

// Load saved state when popup opens
async function loadState() {
  try {
    const result = await chrome.storage.local.get([
      "generatedSteps",
      "currentStepIndex",
      "currentAlternativeIndex",
    ]);

    if (result.generatedSteps && result.generatedSteps.length > 0) {
      generatedSteps = result.generatedSteps;
      currentStepIndex = result.currentStepIndex || 0;
      currentAlternativeIndex = result.currentAlternativeIndex || 0;
      displaySteps(generatedSteps);
      document.getElementById("out").textContent =
        "✅ Restored previous session. Click Next to continue or Reset to start over.";
      document.getElementById("out").style.color = "#4CAF50";
      console.log("[Popup] Restored state:", generatedSteps.length, "steps");
    }
  } catch (e) {
    console.error("[Popup] Error loading state:", e);
  }
}

// Save state to persist across popup closes
async function saveState() {
  try {
    await chrome.storage.local.set({
      generatedSteps: generatedSteps,
      currentStepIndex: currentStepIndex,
      currentAlternativeIndex: currentAlternativeIndex,
    });
  } catch (e) {
    console.error("[Popup] Error saving state:", e);
  }
}

// Clear saved state
async function clearState() {
  try {
    await chrome.storage.local.remove([
      "generatedSteps",
      "currentStepIndex",
      "currentAlternativeIndex",
    ]);
    console.log("[Popup] Cleared saved state");
  } catch (e) {
    console.error("[Popup] Error clearing state:", e);
  }
}

async function fullAuto() {
  const input = document.getElementById("msg");
  const out = document.getElementById("out");
  const task = input.value.trim();

  if (!task) {
    out.textContent = "Please enter a task (e.g., 'post on Instagram')";
    out.style.color = "#f44336";
    return;
  }

  out.textContent = "🤖 AI is generating steps...";
  out.style.color = "#9C27B0";
  console.log(`[Popup] Generating steps for: "${task}"`);

  try {
    const response = await fetch("http://localhost:5000/api/generate-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });

    const data = await response.json();
    console.log("[Popup] Generated steps:", data);

    if (data.success && data.steps) {
      generatedSteps = data.steps;
      currentStepIndex = 0;
      currentAlternativeIndex = 0;
      await saveState(); // Save to storage
      displaySteps(generatedSteps);
      out.textContent = `✅ Generated ${generatedSteps.length} steps. Click Next or Execute All!`;
      out.style.color = "#4CAF50";
    } else {
      out.textContent = `❌ ${data.message || "Failed to generate steps"}`;
      out.style.color = "#f44336";
    }
  } catch (e) {
    console.error("[Popup] Error:", e);
    out.textContent = `Error: ${e.message}`;
    out.style.color = "#f44336";
  }
}

// Display generated steps with edit capability
function displaySteps(steps) {
  const stepsSection = document.getElementById("stepsSection");
  const stepsList = document.getElementById("stepsList");

  stepsSection.style.display = "block";
  stepsList.innerHTML = "";

  steps.forEach((step, index) => {
    const stepDiv = document.createElement("div");
    stepDiv.style.cssText =
      "margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #ddd;";

    // Step header
    const stepHeader = document.createElement("div");
    stepHeader.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;";
    stepHeader.innerHTML = `
      <span style="font-weight: bold; color: #666;">Step ${index + 1}</span>
      <button class="deleteStepBtn" data-index="${index}" style="padding: 2px 8px; font-size: 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
    `;

    // Step content (editable)
    const stepContent = document.createElement("div");
    stepContent.style.cssText = "font-size: 12px;";

    // Display alternatives
    step.forEach((alternative, altIndex) => {
      const [action, param] = alternative;
      const altDiv = document.createElement("div");
      
      // Highlight current step/alternative
      const isCurrent = index === currentStepIndex && altIndex === currentAlternativeIndex;
      const bgColor = isCurrent ? "#fff9c4" : "#f0f0f0";
      const border = isCurrent ? "2px solid #FF9800" : "1px solid #ddd";
      
      altDiv.style.cssText =
        `margin: 4px 0; padding: 4px; background: ${bgColor}; border-radius: 3px; display: flex; align-items: center; gap: 4px; border: ${border};`;

      altDiv.innerHTML = `
        <span style="color: #9C27B0; font-weight: bold; min-width: 60px;">${action}:</span>
        <input type="text" class="stepParam" data-step="${index}" data-alt="${altIndex}" value="${param}" style="flex: 1; padding: 2px 4px; border: 1px solid #ccc; border-radius: 2px; font-size: 11px;" />
        ${isCurrent ? '<span style="color: #FF9800; font-size: 10px; font-weight: bold;">← NEXT</span>' : ""}
        ${altIndex > 0 && !isCurrent ? '<span style="color: #FF9800; font-size: 10px;">(fallback)</span>' : ""}
      `;

      stepContent.appendChild(altDiv);
    });

    stepDiv.appendChild(stepHeader);
    stepDiv.appendChild(stepContent);
    stepsList.appendChild(stepDiv);
  });

  // Add delete listeners
  document.querySelectorAll(".deleteStepBtn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const index = parseInt(e.target.dataset.index);
      generatedSteps.splice(index, 1);
      
      // Adjust current step if needed
      if (currentStepIndex >= generatedSteps.length) {
        currentStepIndex = Math.max(0, generatedSteps.length - 1);
      }
      
      await saveState();
      displaySteps(generatedSteps);
    });
  });

  // Add edit listeners
  document.querySelectorAll(".stepParam").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const stepIndex = parseInt(e.target.dataset.step);
      const altIndex = parseInt(e.target.dataset.alt);
      generatedSteps[stepIndex][altIndex][1] = e.target.value;
      await saveState();
      console.log("[Popup] Updated step:", generatedSteps[stepIndex]);
    });
  });
}

// Clear all steps and saved state
async function clearSteps() {
  const out = document.getElementById("out");
  
  if (generatedSteps.length === 0) {
    out.textContent = "No steps to clear";
    out.style.color = "#f44336";
    return;
  }
  
  generatedSteps = [];
  currentStepIndex = 0;
  currentAlternativeIndex = 0;
  await clearState();
  
  document.getElementById("stepsSection").style.display = "none";
  out.textContent = "🗑️ All steps cleared. Generate new steps to start.";
  out.style.color = "#757575";
  console.log("[Popup] Cleared all steps and saved state");
}

// Reset execution to beginning
async function resetSteps() {
  const out = document.getElementById("out");
  
  if (generatedSteps.length === 0) {
    out.textContent = "No steps to reset";
    out.style.color = "#f44336";
    return;
  }
  
  currentStepIndex = 0;
  currentAlternativeIndex = 0;
  await saveState();
  displaySteps(generatedSteps);
  
  out.textContent = "🔄 Reset to Step 1. Click Next to start.";
  out.style.color = "#757575";
  console.log("[Popup] Reset execution to beginning");
}

// Execute next single action (step or fallback)
async function nextStep() {
  const out = document.getElementById("out");

  if (generatedSteps.length === 0) {
    out.textContent = "No steps to execute";
    out.style.color = "#f44336";
    return;
  }

  // Check if we're done
  if (currentStepIndex >= generatedSteps.length) {
    out.textContent = "✅ All steps completed!";
    out.style.color = "#4CAF50";
    currentStepIndex = 0;
    currentAlternativeIndex = 0;
    await saveState();
    displaySteps(generatedSteps);
    return;
  }

  const alternatives = generatedSteps[currentStepIndex];
  
  // Check if we've exhausted all alternatives for this step - offer to skip
  if (currentAlternativeIndex >= alternatives.length) {
    out.textContent = `❌ Step ${currentStepIndex + 1} FAILED (all ${alternatives.length} alts tried). Click Next again to skip to Step ${currentStepIndex + 2}.`;
    out.style.color = "#f44336";
    
    // Next click will skip to next step
    currentStepIndex++;
    currentAlternativeIndex = 0;
    await saveState();
    displaySteps(generatedSteps);
    return;
  }

  const [action, param] = alternatives[currentAlternativeIndex];
  out.textContent = `⚙️ Step ${currentStepIndex + 1}/${generatedSteps.length}, Alt ${currentAlternativeIndex + 1}...`;
  out.style.color = "#9C27B0";

  console.log(
    `[Popup] Executing step ${currentStepIndex + 1}, alternative ${currentAlternativeIndex + 1}: ${action} "${param}"`
  );

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      out.textContent = "Error: No active tab found";
      out.style.color = "#f44336";
      return;
    }

    const result = await executeAction(tabs[0].id, action, param);

    if (result && result.success) {
      // Success! Move to next step
      console.log(`[Popup] ✅ Step ${currentStepIndex + 1} succeeded`);
      out.textContent = `✅ Step ${currentStepIndex + 1} completed: ${action} "${param}"`;
      out.style.color = "#4CAF50";
      
      // Move to next step
      currentStepIndex++;
      currentAlternativeIndex = 0;
      await saveState();
      displaySteps(generatedSteps);
      
      // Check if done
      if (currentStepIndex >= generatedSteps.length) {
        out.textContent = "🎉 All steps completed successfully!";
      }
    } else {
      // Failed, move to next alternative
      console.warn(
        `[Popup] ❌ Alternative ${currentAlternativeIndex + 1} failed:`,
        result?.message
      );
      out.textContent = `❌ Alt ${currentAlternativeIndex + 1} failed: ${result?.message || "Unknown error"}`;
      out.style.color = "#f44336";
      
      // Move to next alternative
      currentAlternativeIndex++;
      await saveState();
      displaySteps(generatedSteps);
      
      // Check if we've exhausted alternatives
      if (currentAlternativeIndex >= alternatives.length) {
        out.textContent = `❌ Step ${currentStepIndex + 1} failed - all ${alternatives.length} alternatives tried`;
        out.style.color = "#f44336";
      }
    }
  } catch (e) {
    console.error("[Popup] Error:", e);
    out.textContent = `Error: ${e.message}`;
    out.style.color = "#f44336";
  }
}

// Execute all generated steps
async function executeSteps() {
  const out = document.getElementById("out");

  if (generatedSteps.length === 0) {
    out.textContent = "No steps to execute";
    out.style.color = "#f44336";
    return;
  }

  // Reset to beginning
  currentStepIndex = 0;
  currentAlternativeIndex = 0;
  displaySteps(generatedSteps);

  out.textContent = "⚙️ Executing all steps...";
  out.style.color = "#9C27B0";

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      out.textContent = "Error: No active tab found";
      out.style.color = "#f44336";
      return;
    }

    for (let i = 0; i < generatedSteps.length; i++) {
      const alternatives = generatedSteps[i];
      currentStepIndex = i;
      currentAlternativeIndex = 0;
      displaySteps(generatedSteps);
      
      out.textContent = `⚙️ Step ${i + 1}/${generatedSteps.length}...`;

      let success = false;

      // Try each alternative until one succeeds
      for (let j = 0; j < alternatives.length; j++) {
        currentAlternativeIndex = j;
        displaySteps(generatedSteps);
        
        const [action, param] = alternatives[j];
        console.log(`[Popup] Trying step ${i + 1}, alternative ${j + 1}: ${action} "${param}"`);

        const result = await executeAction(tabs[0].id, action, param);

        if (result && result.success) {
          console.log(`[Popup] Step ${i + 1} succeeded with alternative ${j + 1}`);
          success = true;
          break;
        } else {
          console.warn(`[Popup] Step ${i + 1}, alternative ${j + 1} failed:`, result?.message);
        }
      }

      if (!success) {
        out.textContent = `❌ Failed at step ${i + 1}: ${alternatives[0][0]} "${alternatives[0][1]}"`;
        out.style.color = "#f44336";
        return;
      }

      // Small delay between steps
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    currentStepIndex = generatedSteps.length;
    displaySteps(generatedSteps);
    out.textContent = `🎉 All ${generatedSteps.length} steps completed successfully!`;
    out.style.color = "#4CAF50";
  } catch (e) {
    console.error("[Popup] Error executing steps:", e);
    out.textContent = `Error: ${e.message}`;
    out.style.color = "#f44336";
  }
}

// Execute a single action
function executeAction(tabId, action, param) {
  return new Promise((resolve) => {
    let message = {};

    if (action === "click") {
      message = { action: "clickButton", buttonText: param };
    } else if (action === "fill") {
      const parts = param.split("|");
      if (parts.length === 2) {
        message = {
          action: "fillTextbox",
          fieldName: parts[0],
          textToFill: parts[1],
        };
      } else {
        resolve({ success: false, message: "Invalid fill format" });
        return;
      }
    } else if (action === "search") {
      // For search, navigate first then wait
      chrome.tabs.update(
        tabId,
        { url: `https://www.google.com/search?q=${encodeURIComponent(param)}` },
        () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(
              tabId,
              { action: "clickFirstSearchResult" },
              (response) => {
                resolve(response || { success: false });
              }
            );
          }, 3000);
        }
      );
      return;
    } else {
      resolve({ success: false, message: `Unknown action: ${action}` });
      return;
    }

    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false });
      }
    });
  });
}

// Event listeners
document.getElementById("clickBtn").addEventListener("click", clickButton);
document.getElementById("fillBtn").addEventListener("click", fillTextbox);
document.getElementById("searchBtn").addEventListener("click", searchGoogle);
document.getElementById("fullAutoBtn").addEventListener("click", fullAuto);
document.getElementById("clearStepsBtn").addEventListener("click", clearSteps);
document.getElementById("resetStepsBtn").addEventListener("click", resetSteps);
document.getElementById("nextStepBtn").addEventListener("click", nextStep);
document
  .getElementById("executeStepsBtn")
  .addEventListener("click", executeSteps);

// Allow Enter key to trigger click button by default
document.getElementById("msg").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    clickButton();
  }
});

// Load saved state when popup opens
loadState();
