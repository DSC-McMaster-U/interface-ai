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

// Event listeners
document.getElementById("clickBtn").addEventListener("click", clickButton);
document.getElementById("fillBtn").addEventListener("click", fillTextbox);
document.getElementById("searchBtn").addEventListener("click", searchGoogle);

// Allow Enter key to trigger click button by default
document.getElementById("msg").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    clickButton();
  }
});
