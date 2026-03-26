document.addEventListener('DOMContentLoaded', () => {
  const resetButton = document.getElementById('reset-button');
  const countDisplay = document.getElementById('count-display');
  const statusMessage = document.getElementById('status-message');
  const dailyLimitDisplay = document.getElementById('daily-limit-display');
  
  // Load current neutralization count
  loadNeutralizationCount();
  
  // Check daily API usage
  checkDailyApiUsage();
  
  // Setup refresh button
  document.getElementById('refresh-button').addEventListener('click', () => {
    loadNeutralizationCount();
    checkDailyApiUsage();
  });
  
  // Reset counter
  resetButton.addEventListener('click', () => {
    chrome.storage.sync.set({ neutralizationCount: 0 }, () => {
      loadNeutralizationCount();
      showStatus('Counter reset successfully!', 'success');
    });
  });
  
  // Load neutralization count from storage
  function loadNeutralizationCount() {
    chrome.storage.sync.get(['neutralizationCount'], (result) => {
      const count = result.neutralizationCount || 0;
      countDisplay.textContent = count;
    });
  }
  
  // Check daily API usage
  function checkDailyApiUsage() {
    chrome.storage.local.get(['dailyApiCalls', 'lastResetDate'], (result) => {
      const dailyApiCalls = result.dailyApiCalls || 0;
      const lastResetDate = result.lastResetDate ? new Date(result.lastResetDate) : new Date();
      
      // Calculate time until reset
      const now = new Date();
      const nextReset = new Date(lastResetDate);
      nextReset.setDate(nextReset.getDate() + 1);
      nextReset.setHours(0, 0, 0, 0);
      
      const timeUntilReset = nextReset - now;
      const hoursUntilReset = Math.floor(timeUntilReset / (60 * 60 * 1000));
      const minutesUntilReset = Math.floor((timeUntilReset % (60 * 60 * 1000)) / (60 * 1000));
      
      dailyLimitDisplay.innerHTML = `
        <div>API calls today: <strong>${dailyApiCalls}/50</strong></div>
        <div>Resets in: <strong>${hoursUntilReset}h ${minutesUntilReset}m</strong></div>
      `;
    });
  }
  
  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    // Clear message after 3 seconds
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
}); 