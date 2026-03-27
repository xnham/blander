// API Diagnostic Script
// Run this in Chrome DevTools console on any page to test the Anthropic API

(function() {
  console.log('🔍 Anthropic API Diagnostic');
  console.log('============================');
  
  // Get API key from config.js (loaded by the service worker)
  async function getApiKey() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getApiKey' }, (response) => {
        resolve(response?.apiKey || prompt('Enter your Anthropic API key:'));
      });
    });
  }
  
  // Test the Anthropic API with a sample headline
  async function testApi(apiKey) {
    const sampleHeadline = "Trump's Plan to Slash Taxes Would Primarily Benefit the Wealthy, Analysis Finds";
    
    console.log(`Testing with headline: "${sampleHeadline}"`);
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 100,
          temperature: 0.3,
          system: 'You are a helpful assistant that neutralizes news headlines. Remove emotional language, sensationalism, and partisan framing while preserving the key factual information. Find an absurdist or dry-humor angle — the ideal headline reads as dry, boring, and a tad absurd, like a mundane bureaucratic memo about something dramatic. Focus on brevity, clarity and deadpan tone. Preserve the original headline\'s casing style (e.g. title case, sentence case). Preserve abbreviations, acronyms, and proper nouns exactly. Do not add quotation marks. Only respond with the neutralized headline text, nothing else.',
          messages: [
            {
              role: 'user',
              content: `Neutralize this headline: "${sampleHeadline}"`
            }
          ]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      const neutralizedText = data.content[0].text.trim();
      
      console.log('✅ API Test Successful');
      console.log(`Original: "${sampleHeadline}"`);
      console.log(`Neutralized: "${neutralizedText}"`);
      return true;
    } catch (error) {
      console.error('❌ API Test Failed:', error);
      return false;
    }
  }
  
  // Check daily API call limit
  async function checkDailyLimit() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['dailyApiCalls', 'lastResetDate'], (result) => {
        const dailyApiCalls = result.dailyApiCalls || 0;
        const lastResetDate = result.lastResetDate || new Date().toISOString();
        
        console.log(`Current daily API calls: ${dailyApiCalls}`);
        console.log(`Last reset date: ${lastResetDate}`);
        
        const now = new Date();
        const lastReset = new Date(lastResetDate);
        const dayDiff = Math.floor((now - lastReset) / (24 * 60 * 60 * 1000));
        
        if (dayDiff >= 1) {
          console.log('✅ Daily counter should reset (last reset was > 1 day ago)');
        } else {
          console.log(`Daily counter will reset in ${24 - now.getHours() - now.getMinutes()/60} hours`);
        }
        
        resolve(dailyApiCalls);
      });
    });
  }
  
  // Check cached headlines
  async function checkHeadlineCache() {
    // The extension doesn't use storage for headline caching anymore, only in-memory
    console.log('ℹ️ Headline cache is in-memory only and cannot be inspected via storage');
    console.log('To test caching, you would need to visit nytimes.com with the extension active');
  }
  
  // Check extension status
  async function checkExtensionStatus() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['enabled'], (result) => {
        const enabled = result.enabled !== undefined ? result.enabled : true;
        console.log(`Extension enabled: ${enabled ? 'Yes ✅' : 'No ❌'}`);
        resolve(enabled);
      });
    });
  }
  
  // Run all tests
  async function runDiagnostics() {
    try {
      // Check extension status
      const isEnabled = await checkExtensionStatus();
      if (!isEnabled) {
        console.log('⚠️ Extension is disabled. Please enable it for proper testing.');
      }
      
      // Check API key
      const apiKey = await getApiKey();
      if (!apiKey) {
        console.error('❌ No API key configured. Please configure an API key in the extension options.');
        return;
      }
      
      console.log('✅ API key is configured');
      
      // Test API with sample headline
      const apiSuccess = await testApi(apiKey);
      
      // Check daily limit
      await checkDailyLimit();
      
      // Check headline cache
      await checkHeadlineCache();
      
      // Final assessment
      console.log('\n🔍 Diagnostic Summary:');
      console.log('============================');
      if (apiSuccess) {
        console.log('✅ API is working correctly');
        console.log('✅ Extension should be able to neutralize headlines');
      } else {
        console.log('❌ API test failed');
        console.log('⚠️ Extension may not be able to neutralize headlines');
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
    }
  }
  
  // Start diagnostics
  runDiagnostics();
  
  return 'API diagnostic running... check console for results.';
})(); 