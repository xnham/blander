document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const headlineCount = document.getElementById('headline-count');
  const optionsButton = document.getElementById('options-button');
  
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
  
  // Update status display based on extension enabled state
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