// Extension Lifecycle Diagnostic
// Run this in Chrome DevTools console on any page

(function() {
  console.log('🔍 Extension Lifecycle & Storage Diagnostic');
  console.log('==========================================');
  
  // Check message passing to background script
  async function testMessagePassing() {
    console.log('Testing message passing to background script...');
    
    try {
      const result = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout waiting for response from background script'));
        }, 5000);
        
        try {
          // Send a simple ping message to the background script
          chrome.runtime.sendMessage({type: 'PING'}, response => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            resolve(response || {success: true, ping: 'pong'});
          });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      console.log('✅ Message passing successful:', result);
      return true;
    } catch (error) {
      console.error('❌ Message passing failed:', error.message);
      
      // Check if this is a context invalidation error
      if (error.message && (
          error.message.includes('context invalidated') || 
          error.message.includes('Extension context') ||
          error.message.includes('Extension handler'))) {
        console.error('❌ Background script context is invalidated');
      }
      
      return false;
    }
  }
  
  // Check storage functionality
  async function testStorage() {
    console.log('Testing Chrome storage...');
    
    try {
      // Test sync storage
      const syncResult = await new Promise((resolve, reject) => {
        const testValue = { test: 'value_' + Date.now() };
        chrome.storage.sync.set({diagnose_test: testValue}, () => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to write to sync storage: ' + chrome.runtime.lastError.message));
            return;
          }
          
          chrome.storage.sync.get(['diagnose_test'], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error('Failed to read from sync storage: ' + chrome.runtime.lastError.message));
              return;
            }
            
            // Clean up
            chrome.storage.sync.remove('diagnose_test');
            resolve(result.diagnose_test);
          });
        });
      });
      
      // Test local storage
      const localResult = await new Promise((resolve, reject) => {
        const testValue = { test: 'value_' + Date.now() };
        chrome.storage.local.set({diagnose_test: testValue}, () => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to write to local storage: ' + chrome.runtime.lastError.message));
            return;
          }
          
          chrome.storage.local.get(['diagnose_test'], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error('Failed to read from local storage: ' + chrome.runtime.lastError.message));
              return;
            }
            
            // Clean up
            chrome.storage.local.remove('diagnose_test');
            resolve(result.diagnose_test);
          });
        });
      });
      
      console.log('✅ Storage test successful');
      console.log('Sync storage:', syncResult);
      console.log('Local storage:', localResult);
      return true;
    } catch (error) {
      console.error('❌ Storage test failed:', error.message);
      return false;
    }
  }
  
  // Check extension permissions
  function checkPermissions() {
    console.log('Checking extension permissions...');
    
    try {
      // Test nytimes.com access
      const nytimesPermission = location.hostname.includes('nytimes.com');
      console.log(`nytimes.com access: ${nytimesPermission ? '✅ Available (on nytimes.com now)' : '❓ Unknown (not on nytimes.com)'}`);
      
      // Test Anthropic API access
      console.log('Anthropic API access: ❓ Cannot check directly (requires actual API call)');
      
      // Test storage permission
      const storagePermission = typeof chrome.storage !== 'undefined';
      console.log(`Storage permission: ${storagePermission ? '✅ Available' : '❌ Not available'}`);
      
      return true;
    } catch (error) {
      console.error('❌ Permission check failed:', error.message);
      return false;
    }
  }
  
  // Check service worker status
  async function checkServiceWorker() {
    console.log('Checking service worker status...');
    
    try {
      // We can't directly check the service worker status from the content script,
      // but we can infer it from the message passing test
      console.log('Service worker status: ❓ Cannot check directly (inferred from message passing test)');
      return true;
    } catch (error) {
      console.error('❌ Service worker check failed:', error.message);
      return false;
    }
  }
  
  // Run all diagnostics
  async function runDiagnostics() {
    try {
      // Check permissions
      await checkPermissions();
      
      // Check service worker
      await checkServiceWorker();
      
      // Test message passing to background script
      const messagePassing = await testMessagePassing();
      
      // Test storage
      const storage = await testStorage();
      
      // Final assessment
      console.log('\n🔍 Diagnostic Summary:');
      console.log('============================');
      if (messagePassing && storage) {
        console.log('✅ Extension is functioning correctly');
      } else {
        console.log('⚠️ Extension has issues:');
        if (!messagePassing) console.log('  ❌ Message passing to background script failed');
        if (!storage) console.log('  ❌ Storage functionality failed');
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
    }
  }
  
  // Start diagnostics
  runDiagnostics();
  
  return 'Extension diagnostic running... check console for results.';
})(); 