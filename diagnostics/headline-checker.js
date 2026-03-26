// Headline Diagnostic Script
// Run this in Chrome DevTools console on nytimes.com

(function() {
  console.log('🔍 NYTimes Headline Diagnostic');
  console.log('============================');
  
  // 1. Check headline selectors
  const h1Elements = document.querySelectorAll('h1');
  const h2Elements = document.querySelectorAll('h2');
  
  console.log(`Found ${h1Elements.length} h1 elements and ${h2Elements.length} h2 elements`);
  
  // 2. Analyze headlines
  const headlines = [];
  let visibleHeadlines = 0;
  
  function analyzeHeadlines(elements, type) {
    elements.forEach((el, index) => {
      const text = el.textContent.trim();
      const isVisible = el.offsetParent !== null;
      const hasNestedInteractive = !!el.querySelector('button, input');
      const length = text.length;
      const classes = Array.from(el.classList).join(', ');
      const id = el.id;
      const path = getNodePath(el);
      
      if (isVisible) visibleHeadlines++;
      
      if (text.length >= 15 && isVisible && !hasNestedInteractive) {
        headlines.push({
          type,
          index,
          text,
          isGoodCandidate: true,
          path
        });
      }
    });
  }
  
  function getNodePath(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
      } else if (current.className) {
        selector += '.' + Array.from(current.classList).join('.');
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }
  
  analyzeHeadlines(h1Elements, 'h1');
  analyzeHeadlines(h2Elements, 'h2');
  
  console.log(`Found ${visibleHeadlines} visible headlines`);
  console.log(`Found ${headlines.length} good headline candidates`);
  
  // 3. Show good candidates for neutralization
  console.log('\n🔍 Good Headline Candidates:');
  console.table(headlines.map(h => ({
    type: h.type,
    text: h.text,
    path: h.path
  })));
  
  // 4. Check for potential headline containers
  const articleElements = document.querySelectorAll('article');
  console.log(`\nFound ${articleElements.length} article elements that might contain headlines`);
  
  // 5. Check for DOMContentLoaded timing
  console.log('\n🔍 Page Load Timing:');
  const timing = performance.timing;
  const loadTime = timing.loadEventEnd - timing.navigationStart;
  const domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
  console.log(`Page load time: ${loadTime}ms`);
  console.log(`DOMContentLoaded time: ${domContentLoaded}ms`);
  
  // 6. Check for dynamic content changes
  console.log('\n🔍 Starting monitoring for dynamic headline changes (15 seconds)...');
  let dynamicChanges = 0;
  
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      const headlineChanged = Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return node.tagName === 'H1' || node.tagName === 'H2' || 
                 node.querySelector('h1, h2');
        }
        return false;
      });
      
      if (headlineChanged) {
        dynamicChanges++;
        console.log('Dynamic headline change detected');
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  setTimeout(() => {
    observer.disconnect();
    console.log(`\nObservation complete: ${dynamicChanges} dynamic headline changes detected`);
    console.log('============================');
    console.log('📋 Copy and share these results to help with debugging the extension.');
  }, 15000);
  
  return 'Diagnostic running... check console for results in 15 seconds.';
})(); 