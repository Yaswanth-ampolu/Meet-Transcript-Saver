let transcript = [];
let isCapturing = false;
let observer = null;
let meetingTitle = '';
let initializationAttempts = 0;
let maxInitializationAttempts = 10;
let lastTranscriptLength = 0;

console.log('Meet Transcript Saver content script loaded');

// Function to get meeting title
function getMeetingTitle() {
  const titleSelectors = [
    '[data-meeting-title]',
    'title',
    '[jsname="r4nke"]',
    '[data-call-title]',
    '.u6vdEc',
    'h1'
  ];
  
  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement) {
      const title = titleElement.textContent || titleElement.innerText;
      if (title && title.trim() && !title.includes('Google Meet')) {
        meetingTitle = title.trim();
        break;
      }
    }
  }
  
  if (!meetingTitle || meetingTitle.includes('Google Meet')) {
    meetingTitle = 'Google Meet - ' + new Date().toLocaleDateString();
  }
  
  return meetingTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').substring(0, 50);
}

// Function to send transcript updates to background
function sendTranscriptUpdate() {
  if (transcript.length > lastTranscriptLength) {
    const newLines = transcript.slice(lastTranscriptLength);
    chrome.runtime.sendMessage({
      action: 'transcriptUpdate',
      data: newLines
    }).then(() => {
      lastTranscriptLength = transcript.length;
    }).catch(error => {
      console.warn('Could not send transcript update to background:', error);
    });
  }
}

// Function to save transcript in different formats
function saveTranscript(format = 'txt') {
  // Get the latest transcript from background
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getGlobalTranscript' }).then(response => {
      const fullTranscript = response?.transcript || transcript;
      
      if (fullTranscript.length === 0) {
        console.warn('No transcript data to save');
        resolve(false);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const title = getMeetingTitle();
      let content, mimeType, extension;

      switch (format) {
        case 'txt':
          content = `Meeting: ${meetingTitle}\nDate: ${new Date().toLocaleString()}\n\n${fullTranscript.join('\n')}`;
          mimeType = 'text/plain';
          extension = 'txt';
          break;
        
        case 'json':
          content = JSON.stringify({
            meeting: meetingTitle,
            date: new Date().toISOString(),
            transcript: fullTranscript,
            totalLines: fullTranscript.length
          }, null, 2);
          mimeType = 'application/json';
          extension = 'json';
          break;
        
        case 'csv':
          content = 'Timestamp,Speaker,Text\n';
          fullTranscript.forEach((line, index) => {
            const time = new Date(Date.now() - (fullTranscript.length - index) * 2000).toLocaleTimeString();
            content += `"${time}","Unknown","${line.replace(/"/g, '""')}"\n`;
          });
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        
        case 'html':
          content = `<!DOCTYPE html>
<html>
<head>
    <title>Meeting Transcript - ${meetingTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #4285f4; padding-bottom: 10px; margin-bottom: 20px; }
        .transcript-line { margin: 10px 0; padding: 5px; background: #f8f9fa; border-radius: 4px; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Meeting Transcript</h1>
        <p><strong>Meeting:</strong> ${meetingTitle}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Lines:</strong> ${fullTranscript.length}</p>
    </div>
    <div class="transcript">
        ${fullTranscript.map((line, index) => `
            <div class="transcript-line">
                <span class="timestamp">[${new Date(Date.now() - (fullTranscript.length - index) * 2000).toLocaleTimeString()}]</span>
                ${line}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
          mimeType = 'text/html';
          extension = 'html';
          break;
          
        default:
          console.error('Unknown format:', format);
          resolve(false);
          return;
      }

      try {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${title}_transcript_${timestamp}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        console.log(`Transcript saved as ${format}`);
        resolve(true);
      } catch (error) {
        console.error('Error saving transcript:', error);
        resolve(false);
      }
    }).catch(error => {
      console.error('Could not get global transcript:', error);
      resolve(false);
    });
  });
}

// Function to start/stop capturing
function toggleCapturing() {
  if (isCapturing) {
    stopCapturing();
  } else {
    startCapturing();
  }
  return isCapturing;
}

function startCapturing() {
  if (isCapturing) {
    console.log('Already capturing');
    return true;
  }
  
  console.log('Attempting to start capturing...');
  
  // Multiple selectors for different Google Meet layouts
  const captionSelectors = [
    '[jsname="CCowhf"]',  // Main captions container
    '[data-caption-text]', // Alternative selector
    '.iTTPOb',            // Another possible selector
    '[jsname="dsyhDe"]',  // Live captions
    '.a4cQT',             // Backup selector
    '.TBMuR',             // Another variant
    '[jsname="YSxPC"]'    // Yet another variant
  ];

  let captionContainer = null;
  
  for (const selector of captionSelectors) {
    captionContainer = document.querySelector(selector);
    if (captionContainer) {
      console.log('Found captions container with selector:', selector);
      break;
    }
  }

  if (!captionContainer) {
    console.log('Caption container not found, will retry...');
    if (initializationAttempts < maxInitializationAttempts) {
      initializationAttempts++;
      setTimeout(startCapturing, 3000);
    } else {
      console.error('Max initialization attempts reached. Please ensure captions are enabled.');
    }
    return false;
  }

  isCapturing = true;
  initializationAttempts = 0; // Reset attempts on success
  
  // Store transcript in chrome storage
  try {
    chrome.storage.local.set({ isCapturing: true });
  } catch (error) {
    console.warn('Could not save to storage:', error);
  }

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        let text = '';
        
        if (node.nodeType === Node.TEXT_NODE) {
          text = node.textContent?.trim();
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          text = node.innerText || node.textContent;
          text = text?.trim();
        }
        
        if (text && text.length > 0 && !transcript.includes(text)) {
          transcript.push(text);
          console.log('Captured:', text);
          
          // Store updated transcript locally
          try {
            chrome.storage.local.set({ transcript: transcript });
          } catch (error) {
            console.warn('Could not save transcript to storage:', error);
          }
          
          // Send update to background service
          sendTranscriptUpdate();
        }
      });
    });
  });

  observer.observe(captionContainer, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log('Started capturing captions successfully');
  
  // Send periodic updates to background even if no new content
  setInterval(() => {
    if (isCapturing) {
      sendTranscriptUpdate();
    }
  }, 5000);
  
  return true;
}

function stopCapturing() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  isCapturing = false;
  
  try {
    chrome.storage.local.set({ isCapturing: false });
  } catch (error) {
    console.warn('Could not save to storage:', error);
  }
  
  console.log('Stopped capturing captions');
  return true;
}

// Initialize the extension
function init() {
  console.log('Meet Transcript Saver initializing...');
  
  // Load existing transcript from storage
  try {
    chrome.storage.local.get(['transcript', 'isCapturing'], (result) => {
      if (result.transcript && Array.isArray(result.transcript)) {
        transcript = result.transcript;
        lastTranscriptLength = transcript.length;
        console.log('Loaded existing transcript:', transcript.length, 'lines');
      }
      if (result.isCapturing) {
        console.log('Resuming capture from previous session');
        setTimeout(startCapturing, 2000);
      }
    });
  } catch (error) {
    console.warn('Could not load from storage:', error);
  }

  // Auto-start capturing after a delay
  setTimeout(() => {
    if (!isCapturing) {
      console.log('Auto-starting capture');
      startCapturing();
    }
  }, 5000);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      saveTranscript('txt').then(success => {
        if (success) {
          console.log('Transcript saved via keyboard shortcut');
        }
      });
    } else if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      toggleCapturing();
      console.log('Capture toggled via keyboard shortcut');
    } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      transcript = [];
      try {
        chrome.storage.local.set({ transcript: [] });
        chrome.runtime.sendMessage({ action: 'clearGlobalTranscript' });
      } catch (error) {
        console.warn('Could not clear storage:', error);
      }
      console.log('Transcript cleared via keyboard shortcut');
    }
  });

  console.log('Meet Transcript Saver initialized successfully');
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  try {
    switch (request.action) {
      case 'saveTranscript':
        saveTranscript(request.format || 'txt').then(success => {
          sendResponse({ success: success, count: transcript.length });
        });
        break;
        
      case 'toggleCapturing':
        const capturing = toggleCapturing();
        sendResponse({ capturing: capturing });
        break;
        
      case 'startCapturing':
        const started = startCapturing();
        sendResponse({ success: started });
        break;
        
      case 'stopCapturing':
        const stopped = stopCapturing();
        sendResponse({ success: stopped });
        break;
        
      case 'getStatus':
        // Get global status from background
        chrome.runtime.sendMessage({ action: 'getGlobalStatus' }).then(globalStatus => {
          sendResponse({ 
            capturing: isCapturing,
            globalCapturing: globalStatus?.capturing || false,
            count: globalStatus?.count || transcript.length,
            localCount: transcript.length,
            title: getMeetingTitle(),
            activeTabs: globalStatus?.activeTabs || 0
          });
        }).catch(() => {
          sendResponse({ 
            capturing: isCapturing, 
            count: transcript.length,
            title: getMeetingTitle()
          });
        });
        break;
        
      case 'clearTranscript':
        transcript = [];
        lastTranscriptLength = 0;
        try {
          chrome.storage.local.set({ transcript: [] });
          chrome.runtime.sendMessage({ action: 'clearGlobalTranscript' });
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error clearing transcript:', error);
          sendResponse({ success: false });
        }
        break;
        
      default:
        console.warn('Unknown action:', request.action);
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Keep the message channel open for async responses
});

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also try to initialize after page navigation
window.addEventListener('load', () => {
  setTimeout(init, 1000);
});

// Handle page navigation in SPAs like Google Meet
let currentUrl = location.href;
new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    console.log('Page navigated, reinitializing...');
    setTimeout(init, 2000);
  }
}).observe(document, { subtree: true, childList: true });

// Send initial status to background
setTimeout(() => {
  sendTranscriptUpdate();
}, 3000);
