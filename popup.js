document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const headlineCount = document.getElementById('headline-count');
  const optionsButton = document.getElementById('options-button');
  const settingsButton = document.getElementById('settings-button');
  const apiKeyWarning = document.getElementById('api-key-warning');
  const apiKeyOk = document.getElementById('api-key-ok');
  const configureKeyLink = document.getElementById('configure-key-link');
  
  // Get initial state
  chrome.storage.sync.get(['enabled', 'neutralizationCount'], (result) => {
    const enabled = result.enabled !== undefined ? result.enabled : true;
    const neutralizationCount = result.neutralizationCount || 0;
    
    // Set toggle state
    toggle.checked = enabled;
    updateStatusDisplay(enabled);
    
    // Update counter
    headlineCount.textContent = `Headlines neutralized: ${neutralizationCount}`;
  });
  
  // Check API key status
  chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' }, (response) => {
    if (response?.hasKey) {
      apiKeyOk.style.display = 'block';
    } else {
      apiKeyWarning.style.display = 'block';
    }
  });
  
  // Handle toggle changes
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    chrome.storage.sync.set({ enabled });
    updateStatusDisplay(enabled);
  });
  
  // Open options page
  optionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  configureKeyLink.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  function updateStatusDisplay(enabled) {
    if (enabled) {
      statusIndicator.className = 'status-indicator active';
      statusText.textContent = 'Active';
    } else {
      statusIndicator.className = 'status-indicator inactive';
      statusText.textContent = 'Disabled';
    }
  }
}); 