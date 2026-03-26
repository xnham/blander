// Background Script for Blander — News Headline Neutralizer

const DEBUG = false;

async function getApiKey() {
  const { anthropicApiKey } = await chrome.storage.local.get('anthropicApiKey');
  if (anthropicApiKey) return anthropicApiKey;
  try { return CONFIG?.ANTHROPIC_API_KEY || null; } catch { return null; }
}

const MAX_DAILY_API_CALLS = 50;
const API_THROTTLE_DELAY = 200; // 200ms between API calls
const MAX_BATCH_SIZE = 10; // Maximum number of headlines per batch

// In-memory state for efficient operation
const state = {
  pendingRequests: new Map(),  // Cache for in-flight requests
  pendingBatchRequests: new Map(), // Cache for in-flight batch requests
  processingCount: 0,          // Number of in-progress API calls
  dailyApiCalls: null,         // Current API call count
  lastStorageUpdate: 0,        // Last time we updated storage
  pendingStorageUpdates: {},   // Updates waiting to be written
  storageUpdateScheduled: false // Is a storage update scheduled
};

// Global API call throttling
let apiThrottlePromise = Promise.resolve(); // Initial resolved promise

// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  if (DEBUG) console.log('Extension installed or updated');
  
  // Use sync storage for persistent settings across devices
  chrome.storage.sync.set({
    enabled: true,
    neutralizationCount: 0
  });
  
  // Use local storage for frequently changing counters
  chrome.storage.local.set({
    dailyApiCalls: 0,
    lastResetDate: new Date().toISOString(),
    headlineCache: {} // Initialize empty cache
  });
  
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
  
  // Start the keepalive mechanism to prevent service worker termination
  startKeepalive();
});

// Keep the service worker alive by setting up a periodic alarm
function startKeepalive() {
  chrome.alarms.create('keepalive', { periodInMinutes: 0.33 });
}

// Chrome often drops events, so also add event listeners for midnight reset
chrome.alarms.create('dailyReset', { 
  when: getNextMidnight(),
  periodInMinutes: 24 * 60 // Daily
});

// Single unified alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    if (DEBUG) console.log('Service worker keepalive: ' + new Date().toISOString());
  } else if (alarm.name === 'dailyReset') {
    if (DEBUG) console.log('Daily reset alarm triggered');
    resetDailyCounter();
  }
});

// Calculate next midnight timestamp
function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

// Reset the daily counter
function resetDailyCounter() {
  if (DEBUG) console.log('Resetting daily API call counter');
  
  // Reset counters in memory
  state.dailyApiCalls = 0;
  state.processingCount = 0;
  
  // Reset counters in storage
  chrome.storage.local.set({
    dailyApiCalls: 0,
    lastResetDate: new Date().toISOString()
  });
}

// Throttle storage updates to avoid hitting Chrome's rate limits
function scheduleStorageUpdate(updates, immediate = false) {
  // Merge the updates with any pending updates
  state.pendingStorageUpdates = { ...state.pendingStorageUpdates, ...updates };
  
  // Don't schedule multiple updates
  if (state.storageUpdateScheduled && !immediate) {
    return;
  }
  
  const now = Date.now();
  // Only update every 5 seconds unless immediate is true
  const delay = immediate ? 0 : Math.max(0, 5000 - (now - state.lastStorageUpdate));
  
  state.storageUpdateScheduled = true;
  setTimeout(() => {
    executeStorageUpdate();
    state.storageUpdateScheduled = false;
  }, delay);
}

// Execute pending storage updates
function executeStorageUpdate() {
  if (Object.keys(state.pendingStorageUpdates).length === 0) return;
  
  const updates = { ...state.pendingStorageUpdates };
  state.pendingStorageUpdates = {};
  state.lastStorageUpdate = Date.now();
  
  if (DEBUG) console.log('Writing to storage:', updates);
  
  try {
    // Use local storage for frequently changing counters
    chrome.storage.local.set(updates)
      .catch(error => {
        console.error('Error updating storage:', error);
        // Add updates back to pending if they failed
        state.pendingStorageUpdates = { ...state.pendingStorageUpdates, ...updates };
      });
  } catch (error) {
    console.error('Exception during storage update:', error);
    // Re-add failed updates to the queue
    state.pendingStorageUpdates = { ...state.pendingStorageUpdates, ...updates };
  }
}

// Single unified message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    if (DEBUG) console.log('Received ping from content script');
    sendResponse({success: true, ping: 'pong'});
    return;
  }

  if (request.type === 'NEUTRALIZE_TEXT') {
    // Generate a unique key for this text to prevent duplicate processing
    const requestKey = request.text.trim();
    
    // Check if we already have a pending request for this text
    if (state.pendingRequests.has(requestKey)) {
      if (DEBUG) console.log('Duplicate request detected, reusing existing promise');
      
      // Reuse the existing promise
      const existingPromise = state.pendingRequests.get(requestKey);
      existingPromise.then(
        neutralText => {
          try {
            sendResponse({ success: true, neutralText });
          } catch (error) {
            console.error('Error sending response:', error);
          }
        },
        error => {
          try {
            sendResponse({ success: false, error: error.message });
          } catch (responseError) {
            console.error('Error sending error response:', responseError);
          }
        }
      );
      
      return true; // Keep the message channel open
    }
    
    // Create a promise to handle the API call
    const fetchPromise = neutralizeText(request.text);
    
    // Store this promise for potential reuse
    state.pendingRequests.set(requestKey, fetchPromise);
    
    // Set a timeout to clean up the pending request
    setTimeout(() => {
      state.pendingRequests.delete(requestKey);
    }, 10000); // Clean up after 10 seconds
    
    // Handle the promise
    fetchPromise.then(
      neutralText => {
        try {
          sendResponse({ success: true, neutralText });
        } catch (error) {
          console.error('Error sending response:', error);
        }
      },
      error => {
        try {
          console.error('Error neutralizing text:', error);
          sendResponse({ success: false, error: error.message });
        } catch (responseError) {
          console.error('Error sending error response:', responseError);
        }
      }
    );
    
    return true; // Keep the message channel open
  } else if (request.type === 'NEUTRALIZE_BATCH') {
    // Handle batch neutralization requests
    const textArray = request.texts;
    if (!Array.isArray(textArray) || textArray.length === 0) {
      sendResponse({ success: false, error: 'Invalid batch format' });
      return true;
    }
    
    // Limit batch size
    const textsToProcess = textArray.slice(0, MAX_BATCH_SIZE);
    
    // Generate a unique key for this batch
    const batchKey = JSON.stringify(textsToProcess);
    
    // Check if we already have this batch in flight
    if (state.pendingBatchRequests.has(batchKey)) {
      if (DEBUG) console.log('Duplicate batch request detected, reusing existing promise');
      
      const existingPromise = state.pendingBatchRequests.get(batchKey);
      existingPromise.then(
        results => {
          try {
            sendResponse({ success: true, results });
          } catch (error) {
            console.error('Error sending batch response:', error);
          }
        },
        error => {
          try {
            sendResponse({ success: false, error: error.message });
          } catch (responseError) {
            console.error('Error sending batch error response:', responseError);
          }
        }
      );
      
      return true;
    }
    
    // Create a promise to handle the batch API call
    const batchPromise = neutralizeBatch(textsToProcess);
    
    // Store for potential reuse
    state.pendingBatchRequests.set(batchKey, batchPromise);
    
    // Clean up after a timeout
    setTimeout(() => {
      state.pendingBatchRequests.delete(batchKey);
    }, 10000);
    
    // Handle the promise
    batchPromise.then(
      results => {
        try {
          sendResponse({ success: true, results });
        } catch (error) {
          console.error('Error sending batch response:', error);
        }
      },
      error => {
        try {
          console.error('Error neutralizing batch:', error);
          sendResponse({ success: false, error: error.message });
        } catch (responseError) {
          console.error('Error sending batch error response:', responseError);
        }
      }
    );
    
    return true; // Keep the message channel open
  }
});

// Function to neutralize a batch of headlines
async function neutralizeBatch(textArray) {
  // Check if we can make an API call
  const canMakeCall = await canMakeApiCall();
  if (!canMakeCall) {
    if (DEBUG) console.log('Daily API call limit reached, returning original texts');
    // Return original texts if limit reached
    return textArray.map(text => text); // Return unchanged
  }
  
  // Increment processing counter
  state.processingCount++;
  
  try {
    // Use throttling to prevent rate limiting
    await apiThrottlePromise;
    
    // Set up next throttle promise
    apiThrottlePromise = new Promise(resolve => setTimeout(resolve, API_THROTTLE_DELAY));
    
    // Build the prompt with all headlines
    const headlinesFormatted = textArray.map((text, index) => 
      `Headline ${index + 1}: "${text}"`
    ).join('\n');
    
    const apiKey = await getApiKey();
    if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY_HERE') {
      throw new Error('API key is not configured. Open extension options to set your Anthropic API key.');
    }
    
    // Make a single API call for the batch
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        temperature: 0.3,
        system: 'You are a helpful assistant that neutralizes news headlines. Remove emotional language, sensationalism, and partisan framing while preserving all factual information. Focus on brevity, clarity and neutrality. Preserve the original headline\'s casing style (e.g. title case, sentence case). Preserve abbreviations, acronyms, and proper nouns exactly. Do not add quotation marks. Respond with ONLY a JSON array of neutralized headline strings, no other text.',
        messages: [
          {
            role: 'user',
            content: `Neutralize these headlines and respond with ONLY a JSON array of strings:\n${headlinesFormatted}\n\nExample response format: ["Neutralized headline 1", "Neutralized headline 2"]`
          }
        ]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }
    
    // Update counters only on success
    state.processingCount = Math.max(0, state.processingCount - 1);
    state.dailyApiCalls++;
    scheduleStorageUpdate({ dailyApiCalls: state.dailyApiCalls });
    
    const data = await response.json();
    let neutralizedText = data.content[0].text.trim();
    
    // Try JSON parsing first, fall back to numbered-list regex
    let neutralizedHeadlines = [];
    try {
      const parsed = JSON.parse(neutralizedText);
      if (Array.isArray(parsed)) {
        neutralizedHeadlines = parsed.map(h => {
          let s = String(h).trim();
          if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
          return s;
        });
      }
    } catch (_) {
      // Fallback: parse as numbered list
      const lines = neutralizedText.split('\n');
      lines.forEach(line => {
        const match = line.match(/^\d+\.\s+(.+)$/);
        if (match && match[1]) {
          let headline = match[1].trim();
          if (headline.startsWith('"') && headline.endsWith('"')) {
            headline = headline.slice(1, -1);
          }
          neutralizedHeadlines.push(headline);
        }
      });
    }
    
    // Ensure we have the same number of results as inputs
    // Fill with originals if necessary
    while (neutralizedHeadlines.length < textArray.length) {
      const index = neutralizedHeadlines.length;
      if (index < textArray.length) {
        neutralizedHeadlines.push(textArray[index]);
      }
    }
    
    // Increment neutralization count in sync storage
    chrome.storage.sync.get(['neutralizationCount'], (result) => {
      const count = (result.neutralizationCount || 0) + neutralizedHeadlines.length;
      chrome.storage.sync.set({ neutralizationCount: count });
    });
    
    if (DEBUG) console.log('Batch API call successful, neutralized', neutralizedHeadlines.length, 'headlines');
    
    return neutralizedHeadlines;
    
  } catch (error) {
    // Ensure we decrement on error
    state.processingCount = Math.max(0, state.processingCount - 1);
    console.error('Error in batch neutralization:', error);
    throw error;
  }
}

// Function to check if we should reset the daily counter
async function checkAndResetDaily() {
  // If we already have the value in memory, use it instead of reading from storage
  if (state.dailyApiCalls !== null) {
    return { currentCalls: state.dailyApiCalls, processingCount: state.processingCount };
  }
  
  try {
    // Otherwise get values from local storage
    const { dailyApiCalls = 0, lastResetDate = new Date().toISOString() } = 
      await chrome.storage.local.get(['dailyApiCalls', 'lastResetDate']);
    
    // Cache the values in memory
    state.dailyApiCalls = dailyApiCalls;
    
    const now = new Date();
    const lastReset = new Date(lastResetDate);
    
    // Check for day difference (midnight reset)
    const dayDiff = Math.floor((now - lastReset) / (24 * 60 * 60 * 1000));
    
    // Reset if it's been at least one day
    if (dayDiff >= 1) {
      if (DEBUG) console.log('Resetting daily API call counter');
      resetDailyCounter();
      return { currentCalls: 0, processingCount: 0 };
    }
    
    return { currentCalls: state.dailyApiCalls, processingCount: state.processingCount };
  } catch (error) {
    console.error('Error checking daily reset:', error);
    // Use memory state as fallback
    return { currentCalls: state.dailyApiCalls || 0, processingCount: state.processingCount || 0 };
  }
}

// Function to check if we can make an API call
async function canMakeApiCall() {
  const { currentCalls, processingCount } = await checkAndResetDaily();
  
  // Consider both completed calls and in-progress calls
  const totalPotentialCalls = currentCalls + processingCount;
  const canMake = totalPotentialCalls < MAX_DAILY_API_CALLS;
  
  if (DEBUG) console.log(`API call check: ${currentCalls} completed, ${processingCount} in progress, can make: ${canMake}`);
  return canMake;
}

// Function to call the Claude API to neutralize text
async function neutralizeText(text) {
  const apiKey = await getApiKey();
  
  if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    throw new Error('API key is not configured. Open extension options to set your Anthropic API key.');
  }

  // Check if we can make an API call
  const canMakeCall = await canMakeApiCall();
  if (!canMakeCall) {
    if (DEBUG) console.log('Daily API call limit reached, returning original text');
    // Silently return the original text if we've hit the limit
    return text;
  }

  try {
    // Increment the processing counter in memory
    state.processingCount++;
    
    // Use throttling to prevent rate limiting
    await apiThrottlePromise;
    
    // Set up next throttle promise
    apiThrottlePromise = new Promise(resolve => setTimeout(resolve, API_THROTTLE_DELAY));

    // Use the fetch API to call Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 100,
        temperature: 0.3,
        system: 'You are a helpful assistant that neutralizes news headlines. Remove emotional language, sensationalism, and partisan framing while preserving all factual information. Focus on brevity, clarity and neutrality. Preserve the original headline\'s casing style (e.g. title case, sentence case). Preserve abbreviations, acronyms, and proper nouns exactly. Do not add quotation marks. Only respond with the neutralized headline text, nothing else.',
        messages: [
          {
            role: 'user',
            content: `Neutralize this headline: "${text}"`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    // Update counters only on success
    state.processingCount = Math.max(0, state.processingCount - 1);
    state.dailyApiCalls++;
    scheduleStorageUpdate({ dailyApiCalls: state.dailyApiCalls });

    const data = await response.json();
    let neutralizedText = data.content[0].text;
    
    // Strip any quotation marks from the beginning and end of the text
    neutralizedText = neutralizedText.trim();
    if (neutralizedText.startsWith('"') && neutralizedText.endsWith('"')) {
      neutralizedText = neutralizedText.substring(1, neutralizedText.length - 1);
    }
    if (neutralizedText.startsWith('"')) {
      neutralizedText = neutralizedText.substring(1);
    }
    if (neutralizedText.endsWith('"')) {
      neutralizedText = neutralizedText.substring(0, neutralizedText.length - 1);
    }
    
    // Increment neutralization count in sync storage
    chrome.storage.sync.get(['neutralizationCount'], (result) => {
      const count = (result.neutralizationCount || 0) + 1;
      chrome.storage.sync.set({ neutralizationCount: count });
    });
    
    if (DEBUG) console.log('API call attempt for text:', text.substring(0, 30) + '...');
    
    return neutralizedText;
  } catch (error) {
    // Ensure we decrement on error
    state.processingCount = Math.max(0, state.processingCount - 1);
    console.error('Error calling Claude API:', error);
    throw error;
  }
} 