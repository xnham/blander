document.addEventListener('DOMContentLoaded', () => {
  const resetButton = document.getElementById('reset-button');
  const countDisplay = document.getElementById('count-display');
  const statusMessage = document.getElementById('status-message');
  const dailyLimitDisplay = document.getElementById('daily-limit-display');
  
  const apiKeyInput = document.getElementById('api-key-input');
  const saveKeyButton = document.getElementById('save-key-button');
  const removeKeyButton = document.getElementById('remove-key-button');
  const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
  const apiKeyStatus = document.getElementById('api-key-status');
  const apiKeyMessage = document.getElementById('api-key-message');
  
  let keyVisible = false;
  let savedKey = null;
  
  const dailyCostDisplay = document.getElementById('daily-cost');
  const totalCostDisplay = document.getElementById('total-cost');
  const dailyTokensDisplay = document.getElementById('daily-tokens');
  
  loadApiKey();
  loadNeutralizationCount();
  checkDailyApiUsage();
  loadCostEstimates();
  
  // Setup refresh button
  document.getElementById('refresh-button').addEventListener('click', () => {
    loadNeutralizationCount();
    checkDailyApiUsage();
    loadCostEstimates();
  });
  
  // Reset counter
  resetButton.addEventListener('click', () => {
    chrome.storage.sync.set({ neutralizationCount: 0 }, () => {
      loadNeutralizationCount();
      showStatus('Counter reset successfully!', 'success');
    });
  });
  
  // --- API Key Management ---
  
  saveKeyButton.addEventListener('click', saveApiKey);
  
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveApiKey();
  });
  
  removeKeyButton.addEventListener('click', () => {
    chrome.storage.local.remove('anthropicApiKey', () => {
      savedKey = null;
      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
      keyVisible = false;
      toggleKeyVisibility.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      removeKeyButton.style.display = 'none';
      apiKeyStatus.textContent = '';
      apiKeyStatus.className = 'api-key-status';
      showApiKeyMessage('API key removed.', 'success');
    });
  });
  
  toggleKeyVisibility.addEventListener('click', () => {
    keyVisible = !keyVisible;
    apiKeyInput.type = keyVisible ? 'text' : 'password';
    toggleKeyVisibility.innerHTML = keyVisible
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
  
  function loadApiKey() {
    chrome.storage.local.get('anthropicApiKey', (result) => {
      if (result.anthropicApiKey) {
        savedKey = result.anthropicApiKey;
        apiKeyInput.value = savedKey;
        removeKeyButton.style.display = '';
        apiKeyStatus.textContent = `Key configured: ${maskKey(savedKey)}`;
        apiKeyStatus.className = 'api-key-status configured';
      }
    });
  }
  
  function saveApiKey() {
    const key = apiKeyInput.value.trim();
    
    if (!key) {
      showApiKeyMessage('Please enter an API key.', 'error');
      return;
    }
    
    if (!key.startsWith('sk-ant-')) {
      showApiKeyMessage('Invalid key format. Anthropic keys start with "sk-ant-".', 'error');
      return;
    }
    
    chrome.storage.local.set({ anthropicApiKey: key }, () => {
      savedKey = key;
      removeKeyButton.style.display = '';
      apiKeyStatus.textContent = `Key configured: ${maskKey(key)}`;
      apiKeyStatus.className = 'api-key-status configured';
      showApiKeyMessage('API key saved successfully!', 'success');
    });
  }
  
  function maskKey(key) {
    if (key.length <= 12) return '••••••••';
    const tail = key.slice(-8);
    return `sk-ant-${'•'.repeat(8)}${tail}`;
  }
  
  function showApiKeyMessage(message, type) {
    apiKeyMessage.textContent = message;
    apiKeyMessage.className = `status-message ${type}`;
    apiKeyMessage.style.display = 'block';
    setTimeout(() => { apiKeyMessage.style.display = 'none'; }, 3000);
  }
  
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
  
  // Claude Haiku 4.5 pricing: $1/MTok input, $5/MTok output
  function estimateCost(inputTokens, outputTokens) {
    return (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5;
  }
  
  function formatCost(dollars) {
    if (dollars < 0.01) return '$' + dollars.toFixed(4);
    return '$' + dollars.toFixed(2);
  }
  
  function formatTokens(count) {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1) + 'K';
    return count.toLocaleString();
  }
  
  function loadCostEstimates() {
    chrome.storage.local.get(
      ['totalInputTokens', 'totalOutputTokens', 'dailyInputTokens', 'dailyOutputTokens'],
      (result) => {
        const dailyIn = result.dailyInputTokens || 0;
        const dailyOut = result.dailyOutputTokens || 0;
        const totalIn = result.totalInputTokens || 0;
        const totalOut = result.totalOutputTokens || 0;
        
        dailyCostDisplay.textContent = formatCost(estimateCost(dailyIn, dailyOut));
        totalCostDisplay.textContent = formatCost(estimateCost(totalIn, totalOut));
        dailyTokensDisplay.textContent = `${formatTokens(dailyIn)} in / ${formatTokens(dailyOut)} out`;
      }
    );
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