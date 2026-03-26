// Content Script for Blander — News Headline Neutralizer

const DEBUG = false;

// Cache configuration
const CACHE_EXPIRY_HOURS = 48; // Cache headlines for 48 hours

// In-memory cache for headlines (will be synced with storage)
const headlineCache = new Map();

// Extension state
let isEnabled = true;
let observer = null;
let checkInterval = null;
let cleanupInterval = null;
let contextCheckInterval = null;
let debounceTimer = null;
let pendingQueue = [];
let pendingTexts = new Set();
let queueProcessing = false;
let extensionAlive = true;
let restartAttempt = 0;
let isCacheLoaded = false;
let ignoringNextCacheChange = false;

// NYTimes headline selectors organized by category
// This makes it easy to experiment with different selector combinations

// Class-based specific selectors (original approach)
const SPECIFIC_CLASS_SELECTORS = [
  'article p.css-91bpc3',           // Primary article headlines
  'article p.css-1a5fuvt',          // Secondary article headlines
  'article p.css-4blv3u',           // Featured article headlines
  'article p.css-6l658f',           // Feature article headlines
  'article p.css-uzitgk',           // Opinion article headlines
  'article p.css-e8ddhg',           // Sidebar article headlines
  'article p.css-1gg6cw2',          // Live update headlines
  'article p.css-1ue6mod',          // Highlight item headlines
  'article p.css-kaomn7',           // Opinion addon headlines
];

// Pattern-based generic selectors (new approach)
const PATTERN_SELECTORS = [
  'p.indicate-hover',
  'section.story-wrapper p:first-of-type',
  '.css-xdandi > p',
  'div[class*="egyhip"] p',         // Any paragraph in div with egyhip in class name
  'a[href] p',                      // Any paragraph inside a link
  'p.css-tren9k',                   // This specific headline format
];

// Heading-based selectors
const HEADING_SELECTORS = [
  'h4.css-nsjm9t',                  // Section headline in h4
];

// Live updates and special formats
const SPECIAL_FORMAT_SELECTORS = [
  'p.story-wrapper.indicate-hover',  // Live update headline
  'p.indicate-hover.css-ug7vhz',     // Secondary live update headline
];

// Newer article format headlines
const NEWER_FORMAT_SELECTORS = [
  'p.css-tren9k',                   // New article headline format
  'div.css-10uu380 p',              // Headlines inside the newer container
];

// Direct headline targeting (for elements without article parents)
const DIRECT_TARGETING_SELECTORS = [
  'a[href] p.css-91bpc3',
  'a[href] p.css-1a5fuvt',
  'a[href] p.css-4blv3u',
  'a[href] p.css-6l658f',
  'a[href] p.css-uzitgk',
  'a[href] p.css-e8ddhg',
];

// Additional fallbacks for missed elements
const FALLBACK_SELECTORS = [
  'section.story-wrapper p.css-kaomn7',    // Opinion titles in sections
  'p.css-1gg6cw2',                         // Headlines with this class anywhere
  '.css-rgq5s4 p.css-kaomn7',              // Opinion titles in rgq5s4 links
];

// Generic catch-all selectors
const GENERIC_SELECTORS = [
  'p.indicate-hover:not(h2 + p.indicate-hover)',  // Paragraph with indicate-hover class not after a heading
  'a.css-9mylee p',                        // Links with p tags in special formats
  'a.css-1sgl5yx p'                        // Another link format with headlines
];

// ENABLE or DISABLE different selector groups by including them in the HEADLINE_SELECTORS array
// To experiment, add or remove selectors from this array

// NYTimes headline selectors - target headlines but exclude section titles
const HEADLINE_SELECTORS = [
  ...PATTERN_SELECTORS,             // New approach - pattern-based selectors
  // Comment out other categories to disable them
  // ...SPECIFIC_CLASS_SELECTORS,   // Original approach - specific CSS classes
  // ...HEADING_SELECTORS,          // Heading selectors
  // ...SPECIAL_FORMAT_SELECTORS,   // Live updates formats
  // ...NEWER_FORMAT_SELECTORS,     // Newer article format selectors
  // ...DIRECT_TARGETING_SELECTORS,  // Direct headline targeting
  // ...FALLBACK_SELECTORS,         // Additional fallbacks
  // ...GENERIC_SELECTORS           // Generic catch-all selectors
];

// Initialize when the document is ready
function initialize() {
  if (window.location.pathname !== '/') return;
  if (!extensionAlive) return;
  
  try {
    if (DEBUG) console.log('Initializing Blander extension');
    
    // Get extension settings from storage
    chrome.storage.sync.get(['enabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting settings:', chrome.runtime.lastError);
        return;
      }
      
      isEnabled = result.enabled !== undefined ? result.enabled : true;
      
      // Load the headline cache from storage
      loadHeadlineCache();
      
      if (isEnabled) {
        setTimeout(() => {
          if (extensionAlive) {
            setupObserver();
            startPeriodicCheck();
            scanForHeadlines();
            if (cleanupInterval) clearInterval(cleanupInterval);
            cleanupInterval = setInterval(cleanupExpiredCache, 24 * 60 * 60 * 1000);
          }
        }, 200);
      }
    });
    
    // Listen for changes to extension settings
    chrome.storage.onChanged.addListener((changes) => {
      if (!extensionAlive) return;
      
      if (changes.enabled) {
        isEnabled = changes.enabled.newValue;
        
        if (isEnabled) {
          setupObserver();
          startPeriodicCheck();
          scanForHeadlines();
          
          // If cache is already loaded, apply cached headlines immediately
          if (isCacheLoaded) {
            applyAllCachedHeadlines();
          }
        } else {
          stopObserver();
          clearInterval(checkInterval);
          restoreOriginalHeadlines();
        }
      }
      
      // Listen for cache updates from other tabs
      if (changes.headlineCache) {
        if (ignoringNextCacheChange) {
          ignoringNextCacheChange = false;
        } else {
          mergeExternalCacheChanges(changes.headlineCache.newValue);
          
          if (isEnabled) {
            applyAllCachedHeadlines();
          }
        }
      }
    });
  } catch (error) {
    console.error('Error initializing extension:', error);
    attemptRecovery();
  }
}

// Load the headline cache from chrome.storage.local
function loadHeadlineCache() {
  chrome.storage.local.get(['headlineCache'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading cache:', chrome.runtime.lastError);
      isCacheLoaded = true; // Mark as loaded even if there was an error
      return;
    }
    
    const storedCache = result.headlineCache || {};
    const now = Date.now();
    
    // Load valid entries into memory cache
    Object.entries(storedCache).forEach(([originalText, entry]) => {
      if (entry && entry.expiry > now) {
        headlineCache.set(originalText, entry.neutralText);
      }
    });
    
    if (DEBUG) console.log(`Loaded ${headlineCache.size} cached headlines from storage`);
    isCacheLoaded = true;
    
    // Clean up expired entries if needed
    if (Object.keys(storedCache).length > headlineCache.size) {
      cleanupExpiredCache();
    }
    
    // Apply all cached headlines immediately with multiple retries
    if (isEnabled) {
      // Attempt multiple times to catch headlines as they load
      setTimeout(() => applyAllCachedHeadlines(), 100);
      setTimeout(() => applyAllCachedHeadlines(), 500);
      setTimeout(() => applyAllCachedHeadlines(), 1500);
      setTimeout(() => applyAllCachedHeadlines(), 3000);
    }
  });
}

// Clean up expired cache entries from both storage and in-memory Map
function cleanupExpiredCache() {
  if (DEBUG) console.log('Cleaning up expired cache entries');
  
  chrome.storage.local.get(['headlineCache'], (result) => {
    if (chrome.runtime.lastError || !result.headlineCache) return;
    
    const storedCache = result.headlineCache;
    const now = Date.now();
    let hasExpired = false;
    
    Object.entries(storedCache).forEach(([originalText, entry]) => {
      if (entry.expiry <= now) {
        delete storedCache[originalText];
        headlineCache.delete(originalText);
        hasExpired = true;
      }
    });
    
    if (hasExpired) {
      chrome.storage.local.set({ headlineCache: storedCache });
    }
  });
}

// Add or update a headline in the cache
function updateHeadlineCache(originalText, neutralText) {
  // Add to in-memory cache
  headlineCache.set(originalText, neutralText);
  
  // Add to persistent storage with expiry
  chrome.storage.local.get(['headlineCache'], (result) => {
    const storedCache = result.headlineCache || {};
    const expiry = Date.now() + (CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Update the stored cache
    storedCache[originalText] = {
      neutralText,
      expiry,
      timestamp: Date.now()
    };
    
    // Save back to storage
    ignoringNextCacheChange = true;
    chrome.storage.local.set({ headlineCache: storedCache });
  });
}

// Merge changes to the cache from other tabs/instances
function mergeExternalCacheChanges(newCache) {
  if (!newCache) return;
  
  Object.entries(newCache).forEach(([originalText, entry]) => {
    if (entry && entry.expiry > Date.now()) {
      // Update in-memory cache with external changes
      headlineCache.set(originalText, entry.neutralText);
    }
  });
}

// Setup mutation observer to detect DOM changes
function setupObserver() {
  try {
    // Disconnect any existing observer
    if (observer) {
      observer.disconnect();
    }
    
    // Create a new observer
    observer = new MutationObserver((mutations) => {
      if (!extensionAlive || !isEnabled) return;
      
      // Look for specific headline-related changes
      let shouldProcess = false;
      
      for (const mutation of mutations) {
        // If we see nodes added, check if they might be headlines
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // If it's an element that might contain or be a headline
              if (node.tagName === 'ARTICLE' || 
                  node.tagName === 'SECTION' || 
                  node.tagName === 'H4' || 
                  node.className?.includes('css-')) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        
        if (shouldProcess) break;
      }
      
      if (shouldProcess) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          applyAllCachedHeadlines();
          scanForHeadlines();
        }, 200);
      }
    });
    
    // Start observing with minimal config
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } catch (error) {
    console.error('Error setting up observer:', error);
  }
}

// Scan for headlines, apply cached ones, and queue uncached for API processing
function scanForHeadlines() {
  if (!extensionAlive || !isEnabled || !isCacheLoaded) return;
  
  try {
    if (DEBUG) console.log('Scanning for headlines...');
    
    const headlineElements = [];
    
    HEADLINE_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.offsetParent !== null && 
            el.textContent.trim().length >= 15 && 
            !el.querySelector('button, input') &&
            !el.hasAttribute('data-neutralized')) {
          headlineElements.push(el);
        }
      });
    });
    
    if (DEBUG) console.log(`Found ${headlineElements.length} headlines to process`);
    if (headlineElements.length === 0) return;
    
    let cachedCount = 0;
    let queuedCount = 0;
    
    headlineElements.forEach(element => {
      const text = element.textContent.trim();
      
      const cached = findCachedHeadline(text);
      if (cached) {
        updateHeadlineElement(element, cached, text);
        cachedCount++;
      } else if (!pendingTexts.has(text)) {
        pendingQueue.push({ element, text });
        pendingTexts.add(text);
        queuedCount++;
      }
    });
    
    if (DEBUG && cachedCount > 0) console.log(`Applied ${cachedCount} cached headlines`);
    if (DEBUG && queuedCount > 0) console.log(`Queued ${queuedCount} headlines for API processing`);
    
    processQueue();
  } catch (error) {
    console.error('Error scanning for headlines:', error);
  }
}

// Process the pending queue in batches, recursing until empty
async function processQueue() {
  if (queueProcessing || pendingQueue.length === 0 || !extensionAlive || !isEnabled) return;
  
  queueProcessing = true;
  
  try {
    const batch = pendingQueue.splice(0, 10);
    
    // Filter to elements still connected and not yet neutralized
    const validBatch = batch.filter(item =>
      item.element.isConnected && !item.element.hasAttribute('data-neutralized')
    );
    
    // Clean up pendingTexts for invalid items
    batch.filter(item => !validBatch.includes(item))
      .forEach(item => pendingTexts.delete(item.text));
    
    if (validBatch.length === 0) {
      queueProcessing = false;
      if (pendingQueue.length > 0) processQueue();
      return;
    }
    
    // Recheck cache before making API call
    const uncachedItems = [];
    validBatch.forEach(item => {
      const cached = findCachedHeadline(item.text);
      if (cached) {
        updateHeadlineElement(item.element, cached, item.text);
        pendingTexts.delete(item.text);
      } else {
        uncachedItems.push(item);
      }
    });
    
    if (uncachedItems.length > 0) {
      const elements = uncachedItems.map(item => item.element);
      const texts = uncachedItems.map(item => item.text);
      
      if (DEBUG) console.log(`Processing ${texts.length} uncached headlines via API`);
      
      try {
        let response;
        if (texts.length === 1) {
          response = await sendToBackground(texts[0]);
          if (response && response.success) {
            updateHeadlineCache(texts[0], response.neutralText);
            updateHeadlineElement(elements[0], response.neutralText, texts[0]);
          } else if (response && response.error) {
            console.error('Error neutralizing headline:', response.error);
            markHeadlineWithError(elements[0]);
          }
        } else {
          response = await sendBatchToBackground(texts);
          if (response && response.success) {
            elements.forEach((element, index) => {
              if (index < response.results.length) {
                updateHeadlineCache(texts[index], response.results[index]);
                updateHeadlineElement(element, response.results[index], texts[index]);
              }
            });
            if (DEBUG) console.log('API batch processing complete');
          } else if (response && response.error) {
            console.error('Error processing batch:', response.error);
            elements.forEach(el => markHeadlineWithError(el));
          }
        }
      } catch (error) {
        console.error('Error processing queue batch:', error);
        if (error.message && (
            error.message.includes('context invalidated') ||
            error.message.includes('Extension context'))) {
          extensionAlive = false;
          attemptRecovery();
          return;
        }
      }
      
      uncachedItems.forEach(item => pendingTexts.delete(item.text));
    }
  } catch (error) {
    console.error('Error in processQueue:', error);
  } finally {
    queueProcessing = false;
    if (pendingQueue.length > 0 && extensionAlive && isEnabled) {
      processQueue();
    }
  }
}

// Send batch to background script
function sendBatchToBackground(texts) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout waiting for response from background script'));
    }, 15000); // Longer timeout for batch processing
    
    try {
      chrome.runtime.sendMessage({
        type: 'NEUTRALIZE_BATCH',
        texts: texts
      }, response => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

// Send message to background script
function sendToBackground(text) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout waiting for response from background script'));
    }, 8000);
    
    try {
      chrome.runtime.sendMessage({
        type: 'NEUTRALIZE_TEXT',
        text: text
      }, response => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

// Update headline element with neutralized text
function updateHeadlineElement(element, neutralText, originalText) {
  try {
    // Store original text
    if (!element.hasAttribute('data-original')) {
      element.setAttribute('data-original', originalText);
    }
    
    // Update text
    element.textContent = neutralText;
    element.setAttribute('data-neutralized', 'true');
    
    // Add indicator
    addNeutralizedIndicator(element);
    
  } catch (error) {
    console.error('Error updating headline:', error);
  }
}

// Normalize headline text for consistent cache lookup
function normalizeHeadlineText(text) {
  if (!text) return '';
  // Normalize whitespace, remove non-breaking spaces and trim
  return text.replace(/\s+/g, ' ')
             .replace(/\u00A0/g, ' ')
             .trim();
}

// Look up cached neutral text for a headline (with normalization).
// Returns the neutral string or null if not cached.
function findCachedHeadline(text) {
  if (!text) return null;
  
  const normalizedText = normalizeHeadlineText(text);
  
  if (headlineCache.has(normalizedText)) {
    return headlineCache.get(normalizedText);
  }
  
  // Fallback: match ignoring punctuation
  const simplifiedText = normalizedText.replace(/[^\w\s]/g, '').trim();
  for (const [key, value] of headlineCache.entries()) {
    const simplifiedKey = key.replace(/[^\w\s]/g, '').trim();
    if (simplifiedKey === simplifiedText) {
      headlineCache.set(normalizedText, value);
      return value;
    }
  }
  
  return null;
}

// Add neutralized indicator dot
function addNeutralizedIndicator(element) {
  try {
    if (element.querySelector('.neutralizer-indicator')) {
      return; // Already has indicator
    }
    
    const indicator = document.createElement('span');
    indicator.className = 'neutralizer-indicator';
    indicator.style.display = 'inline-block';
    indicator.style.width = '8px';
    indicator.style.height = '8px';
    indicator.style.borderRadius = '50%';
    indicator.style.backgroundColor = '#61afef';
    indicator.style.marginLeft = '5px';
    indicator.title = 'Neutralized by Blander';
    
    element.appendChild(indicator);
  } catch (error) {
    console.error('Error adding indicator:', error);
  }
}

// Mark headline with error indicator
function markHeadlineWithError(element) {
  try {
    if (element.querySelector('.neutralizer-error-indicator')) {
      return; // Already has error indicator
    }
    
    const indicator = document.createElement('span');
    indicator.className = 'neutralizer-error-indicator';
    indicator.style.display = 'inline-block';
    indicator.style.width = '8px';
    indicator.style.height = '8px';
    indicator.style.borderRadius = '50%';
    indicator.style.backgroundColor = '#e06c75';
    indicator.style.marginLeft = '5px';
    
    element.appendChild(indicator);
  } catch (error) {
    console.error('Error marking headline with error:', error);
  }
}

// Restore original headlines
function restoreOriginalHeadlines() {
  try {
    document.querySelectorAll('[data-neutralized="true"]').forEach(el => {
      restoreOriginalHeadline(el);
    });
  } catch (error) {
    console.error('Error restoring headlines:', error);
  }
}

// Restore original headline for a specific element
function restoreOriginalHeadline(element) {
  try {
    if (element.hasAttribute('data-original')) {
      // Setting textContent replaces all child nodes, removing indicators automatically
      element.textContent = element.getAttribute('data-original');
      element.removeAttribute('data-neutralized');
    }
  } catch (error) {
    console.error('Error restoring original headline:', error);
  }
}

// Fallback periodic scan for headlines the observer might miss
function startPeriodicCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  checkInterval = setInterval(() => {
    if (extensionAlive && isEnabled) {
      scanForHeadlines();
    } else {
      clearInterval(checkInterval);
    }
  }, 30000);
}

// Stop the observer
function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Attempt to recover from context invalidation
function attemptRecovery() {
  restartAttempt++;
  
  if (restartAttempt <= 3) {
    if (DEBUG) console.log(`Attempting recovery (${restartAttempt}/3)...`);
    
    // Clean up
    stopObserver();
    clearInterval(checkInterval);
    clearInterval(cleanupInterval);
    
    // Try to restart
    setTimeout(() => {
      extensionAlive = true;
      initialize();
    }, 3000 * restartAttempt);
  } else {
    console.error('Max recovery attempts reached. Please reload the page.');
  }
}

// Check for context invalidation
function checkContext() {
  try {
    // This will throw if context is invalidated
    chrome.runtime.getURL('');
    return true;
  } catch (error) {
    console.error('Extension context invalidated');
    extensionAlive = false;
    attemptRecovery();
    return false;
  }
}

// Periodically check for context invalidation
contextCheckInterval = setInterval(checkContext, 30000);

// Start on document load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Apply all cached headlines immediately after cache is loaded
function applyAllCachedHeadlines() {
  if (!extensionAlive || !isEnabled || !isCacheLoaded) return;
  
  if (DEBUG) console.log('Applying all cached headlines');
  
  // Get all headline elements
  const cachedElements = [];
  
  HEADLINE_SELECTORS.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      // Only include visible elements with sufficient text that haven't been neutralized
      if (el.offsetParent !== null && 
          el.textContent.trim().length >= 15 && 
          !el.querySelector('button, input') &&
          !el.hasAttribute('data-neutralized')) {
        
        const text = el.textContent.trim();
        if (findCachedHeadline(text)) {
          cachedElements.push({ element: el, text });
        }
      }
    });
  });
  
  if (cachedElements.length > 0) {
    if (DEBUG) console.log(`Found ${cachedElements.length} cached headlines to apply immediately`);
    
    cachedElements.forEach(({ element, text }) => {
      const neutralText = findCachedHeadline(text);
      if (neutralText) {
        updateHeadlineElement(element, neutralText, text);
      }
    });
    
    if (DEBUG) console.log(`Applied ${cachedElements.length} cached headlines`);
  }
}