// Background service worker for InterfaceAI
console.log("InterfaceAI background service worker loaded");

// Store execution state
let currentExecution = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startExecution") {
    startExecution(message.steps, message.tabId)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (message.action === "getExecutionStatus") {
    sendResponse({ execution: currentExecution });
    return false;
  }
});

// Start executing steps on a tab
async function startExecution(steps, tabId) {
  currentExecution = {
    tabId,
    steps,
    currentStep: 0,
    status: "running",
    results: []
  };
  
  try {
    for (let i = 0; i < steps.length; i++) {
      currentExecution.currentStep = i;
      const step = steps[i];
      
      console.log(`Executing step ${i + 1}/${steps.length}:`, step);
      
      // Handle navigation in background (tabs API)
      if (step.action.toLowerCase() === "navigate") {
        const url = step.value || step.target;
        await navigateTab(tabId, url);
        await sleep(2000); // Wait for page load
        
        currentExecution.results.push({
          step: i + 1,
          success: true,
          message: `Navigated to ${url}`
        });
      } else {
        // Send other actions to content script
        const result = await executeStepInTab(tabId, step);
        currentExecution.results.push({
          step: i + 1,
          success: true,
          result
        });
      }
      
      // Update popup with progress
      chrome.runtime.sendMessage({
        action: "executionProgress",
        step: i + 1,
        total: steps.length
      }).catch(() => {}); // Ignore if popup is closed
      
      // Wait between steps
      await sleep(1000);
    }
    
    currentExecution.status = "completed";
    return currentExecution.results;
    
  } catch (error) {
    console.error("Execution error:", error);
    currentExecution.status = "failed";
    currentExecution.error = error.message;
    
    currentExecution.results.push({
      step: currentExecution.currentStep + 1,
      success: false,
      error: error.message
    });
    
    throw error;
  }
}

// Navigate to URL using tabs API
function navigateTab(tabId, url) {
  return new Promise((resolve, reject) => {
    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    
    chrome.tabs.update(tabId, { url }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Wait for page to load
        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
          if (updatedTabId === tabId && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      }
    });
  });
}

// Execute a step in the content script
function executeStepInTab(tabId, step) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { action: "executeStep", step },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response ? response.error : "Unknown error"));
        }
      }
    );
  });
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
