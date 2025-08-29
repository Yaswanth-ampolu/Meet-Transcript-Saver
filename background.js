// Background service worker for persistent transcript capture
console.log('Meet Transcript Saver background service worker loaded');

let activeCaptureTabs = new Set();
let globalTranscript = [];
let isGlobalCapturing = false;

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed, initializing storage');
  chrome.storage.local.set({
    transcript: [],
    isCapturing: false,
    activeTabs: []
  });
});

// Monitor tab updates to detect Google Meet tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('meet.google.com')) {
    console.log('Google Meet tab detected:', tabId);
    
    // Inject content script if not already injected
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      console.log('Content script injected into tab:', tabId);
      
      // If global capturing is enabled, start capturing in this tab
      if (isGlobalCapturing) {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'startCapturing' }, (response) => {
            if (response && response.success) {
              activeCaptureTabs.add(tabId);
              updateStoredActiveTabs();
            }
          });
        }, 2000);
      }
    }).catch((error) => {
      console.log('Content script already injected or error:', error);
    });
  }
});

// Monitor tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeCaptureTabs.has(tabId)) {
    activeCaptureTabs.delete(tabId);
    updateStoredActiveTabs();
    console.log('Removed closed tab from active captures:', tabId);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request, 'from:', sender);
  
  switch (request.action) {
    case 'transcriptUpdate':
      handleTranscriptUpdate(request.data, sender.tab?.id);
      sendResponse({ success: true });
      break;
      
    case 'startGlobalCapture':
      startGlobalCapture();
      sendResponse({ success: true, capturing: isGlobalCapturing });
      break;
      
    case 'stopGlobalCapture':
      stopGlobalCapture();
      sendResponse({ success: true, capturing: isGlobalCapturing });
      break;
      
    case 'getGlobalStatus':
      sendResponse({
        capturing: isGlobalCapturing,
        count: globalTranscript.length,
        activeTabs: activeCaptureTabs.size
      });
      break;
      
    case 'clearGlobalTranscript':
      clearGlobalTranscript();
      sendResponse({ success: true });
      break;
      
    case 'getGlobalTranscript':
      sendResponse({
        transcript: globalTranscript,
        count: globalTranscript.length
      });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // Keep message channel open
});

// Handle transcript updates from content scripts
function handleTranscriptUpdate(newLines, tabId) {
  if (!Array.isArray(newLines)) return;
  
  let added = 0;
  newLines.forEach(line => {
    if (line && typeof line === 'string' && !globalTranscript.includes(line)) {
      globalTranscript.push(line);
      added++;
    }
  });
  
  if (added > 0) {
    console.log(`Added ${added} new transcript lines from tab ${tabId}`);
    
    // Update storage
    chrome.storage.local.set({
      transcript: globalTranscript
    });
    
    // Update badge
    updateBadge();
  }
}

// Start global capture across all Google Meet tabs
async function startGlobalCapture() {
  console.log('Starting global capture');
  isGlobalCapturing = true;
  
  // Update storage
  chrome.storage.local.set({ isCapturing: true });
  
  // Find all Google Meet tabs
  const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
  
  for (const tab of tabs) {
    try {
      // Ensure content script is injected
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Start capturing in this tab
      chrome.tabs.sendMessage(tab.id, { action: 'startCapturing' }, (response) => {
        if (response && response.success) {
          activeCaptureTabs.add(tab.id);
          console.log('Started capturing in tab:', tab.id);
        }
      });
    } catch (error) {
      console.log('Error starting capture in tab', tab.id, ':', error);
    }
  }
  
  updateStoredActiveTabs();
  updateBadge();
}

// Stop global capture
async function stopGlobalCapture() {
  console.log('Stopping global capture');
  isGlobalCapturing = false;
  
  // Update storage
  chrome.storage.local.set({ isCapturing: false });
  
  // Stop capturing in all active tabs
  for (const tabId of activeCaptureTabs) {
    chrome.tabs.sendMessage(tabId, { action: 'stopCapturing' }, (response) => {
      console.log('Stopped capturing in tab:', tabId);
    });
  }
  
  activeCaptureTabs.clear();
  updateStoredActiveTabs();
  updateBadge();
}

// Clear global transcript
function clearGlobalTranscript() {
  globalTranscript = [];
  chrome.storage.local.set({ transcript: [] });
  updateBadge();
  console.log('Global transcript cleared');
}

// Update stored active tabs
function updateStoredActiveTabs() {
  chrome.storage.local.set({
    activeTabs: Array.from(activeCaptureTabs)
  });
}

// Update extension badge
function updateBadge() {
  const count = globalTranscript.length;
  const text = count > 0 ? count.toString() : '';
  const color = isGlobalCapturing ? '#4CAF50' : '#757575';
  
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Load existing state on startup
chrome.storage.local.get(['transcript', 'isCapturing', 'activeTabs'], (result) => {
  if (result.transcript && Array.isArray(result.transcript)) {
    globalTranscript = result.transcript;
    console.log('Loaded existing transcript:', globalTranscript.length, 'lines');
  }
  
  if (result.isCapturing) {
    isGlobalCapturing = result.isCapturing;
    console.log('Resuming global capture from previous session');
    
    // Restart capture after a delay
    setTimeout(startGlobalCapture, 3000);
  }
  
  if (result.activeTabs && Array.isArray(result.activeTabs)) {
    activeCaptureTabs = new Set(result.activeTabs);
  }
  
  updateBadge();
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
});

// Handle extension icon click (optional - for quick toggle)
chrome.action.onClicked.addListener((tab) => {
  // Open popup instead of handling click here
  console.log('Extension icon clicked');
}); 