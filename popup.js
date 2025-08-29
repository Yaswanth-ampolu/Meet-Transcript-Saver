document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleCapture');
    const clearBtn = document.getElementById('clearTranscript');
    const exportBtns = document.querySelectorAll('.export-btn');
    const captureStatus = document.getElementById('captureStatus');
    const lineCount = document.getElementById('lineCount');
    const meetingTitle = document.getElementById('meetingTitle');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');

    let isGlobalCapturing = false;
    let transcriptCount = 0;
    let activeTabs = 0;

    // Function to show success message
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }

    // Function to show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // Function to update status display
    function updateStatus(capturing, count, title, activeTabCount = 0) {
        isGlobalCapturing = capturing;
        transcriptCount = count;
        activeTabs = activeTabCount;
        
        if (capturing) {
            captureStatus.textContent = `Capturing (${activeTabCount} tabs)`;
            captureStatus.className = 'status-value capturing';
        } else {
            captureStatus.textContent = 'Stopped';
            captureStatus.className = 'status-value not-capturing';
        }
        
        lineCount.textContent = count || 0;
        meetingTitle.textContent = title || 'Background Service';
        
        toggleBtn.textContent = capturing ? 'Stop All Capture' : 'Start Global Capture';
        toggleBtn.className = capturing ? 'danger-btn' : 'primary-btn';
        
        // Enable/disable export buttons based on transcript count
        exportBtns.forEach(btn => {
            btn.disabled = count === 0;
            btn.style.opacity = count === 0 ? '0.5' : '1';
        });
    }

    // Function to send message to background service
    function sendMessageToBackground(message, callback) {
        chrome.runtime.sendMessage(message).then(response => {
            if (callback) callback(response);
        }).catch(error => {
            console.error('Background message error:', error);
            showError('Could not connect to background service');
        });
    }

    // Function to get current tab and send message (for exports)
    function sendMessageToActiveTab(message, callback) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (chrome.runtime.lastError) {
                console.error('Chrome runtime error:', chrome.runtime.lastError);
                showError('Extension error: ' + chrome.runtime.lastError.message);
                return;
            }

            if (!tabs || tabs.length === 0) {
                showError('No active tab found');
                return;
            }

            const tab = tabs[0];
            
            if (!tab.url || !tab.url.includes('meet.google.com')) {
                showError('Please open a Google Meet tab to export');
                return;
            }

            // Try to inject content script if it's not already there
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            }).then(() => {
                // Wait a bit for the script to load
                setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, message, function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('Message error:', chrome.runtime.lastError);
                            showError('Could not connect to Google Meet tab for export');
                        } else if (callback) {
                            callback(response);
                        }
                    });
                }, 500);
            }).catch((error) => {
                console.error('Script injection error:', error);
                // Try sending message anyway (script might already be loaded)
                chrome.tabs.sendMessage(tab.id, message, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Message error:', chrome.runtime.lastError);
                        showError('Could not connect to Google Meet tab for export');
                    } else if (callback) {
                        callback(response);
                    }
                });
            });
        });
    }

    // Initialize status
    function initializeStatus() {
        captureStatus.textContent = 'Connecting...';
        
        sendMessageToBackground({ action: 'getGlobalStatus' }, function(response) {
            if (response) {
                updateStatus(response.capturing, response.count, 'Background Service', response.activeTabs);
                if (response.capturing) {
                    showSuccess(`Global capture active across ${response.activeTabs} tabs`);
                } else {
                    showSuccess('Connected to background service');
                }
            } else {
                captureStatus.textContent = 'Service Error';
                showError('Could not connect to background service');
            }
        });
    }

    // Toggle capture button - now controls global capture
    toggleBtn.addEventListener('click', function() {
        const button = this;
        button.classList.add('loading');
        button.disabled = true;
        
        const action = isGlobalCapturing ? 'stopGlobalCapture' : 'startGlobalCapture';
        
        sendMessageToBackground({ action: action }, function(response) {
            button.classList.remove('loading');
            button.disabled = false;
            
            if (response && response.hasOwnProperty('capturing')) {
                // Refresh status to get updated info
                setTimeout(() => {
                    sendMessageToBackground({ action: 'getGlobalStatus' }, function(statusResponse) {
                        if (statusResponse) {
                            updateStatus(statusResponse.capturing, statusResponse.count, 'Background Service', statusResponse.activeTabs);
                            const message = statusResponse.capturing 
                                ? `Started global capture across ${statusResponse.activeTabs} Google Meet tabs`
                                : 'Stopped global capture';
                            showSuccess(message);
                        }
                    });
                }, 500);
            } else {
                showError('Failed to toggle global capture');
            }
        });
    });

    // Clear transcript button - now clears global transcript
    clearBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear the global transcript from all tabs?')) {
            const button = this;
            button.classList.add('loading');
            button.disabled = true;
            
            sendMessageToBackground({ action: 'clearGlobalTranscript' }, function(response) {
                button.classList.remove('loading');
                button.disabled = false;
                
                if (response && response.success) {
                    updateStatus(isGlobalCapturing, 0, 'Background Service', activeTabs);
                    showSuccess('Global transcript cleared');
                } else {
                    showError('Failed to clear global transcript');
                }
            });
        }
    });

    // Export buttons - export from any Google Meet tab
    exportBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (transcriptCount === 0) {
                showError('No transcript data to export. Make sure captions are enabled in Google Meet.');
                return;
            }

            const format = this.getAttribute('data-format');
            const button = this;
            button.classList.add('loading');
            button.disabled = true;
            
            // Try to export from current tab if it's Google Meet, otherwise find any Google Meet tab
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const currentTab = tabs[0];
                
                if (currentTab && currentTab.url && currentTab.url.includes('meet.google.com')) {
                    // Export from current tab
                    sendMessageToActiveTab({action: 'saveTranscript', format: format}, function(response) {
                        button.classList.remove('loading');
                        button.disabled = false;
                        
                        if (response && response.success) {
                            showSuccess(`Transcript exported as ${format.toUpperCase()} (${response.count} lines)`);
                        } else {
                            showError(`Failed to export as ${format.toUpperCase()}`);
                        }
                    });
                } else {
                    // Find any Google Meet tab to export from
                    chrome.tabs.query({url: 'https://meet.google.com/*'}, function(meetTabs) {
                        if (meetTabs && meetTabs.length > 0) {
                            chrome.tabs.sendMessage(meetTabs[0].id, {action: 'saveTranscript', format: format}, function(response) {
                                button.classList.remove('loading');
                                button.disabled = false;
                                
                                if (response && response.success) {
                                    showSuccess(`Transcript exported as ${format.toUpperCase()} (${response.count} lines)`);
                                } else {
                                    showError(`Failed to export as ${format.toUpperCase()}`);
                                }
                            });
                        } else {
                            button.classList.remove('loading');
                            button.disabled = false;
                            showError('No Google Meet tabs found for export');
                        }
                    });
                }
            });
        });
    });

    // Auto-refresh status every 3 seconds
    setInterval(function() {
        if (captureStatus.textContent !== 'Connecting...' && captureStatus.textContent !== 'Service Error') {
            sendMessageToBackground({ action: 'getGlobalStatus' }, function(response) {
                if (response) {
                    updateStatus(response.capturing, response.count, 'Background Service', response.activeTabs);
                }
            });
        }
    }, 3000);

    // Initialize on popup open
    setTimeout(initializeStatus, 100);
});
  