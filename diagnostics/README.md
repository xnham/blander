# Extension Diagnostics

These diagnostic tools will help identify issues with the Chrome extension. Follow the instructions below to run each script and interpret the results.

## How to Run Diagnostics

1. Open Chrome DevTools on a page where you want to run diagnostics:
   - On nytimes.com (for headline-checker.js)
   - On any page (for api-checker.js and extension-checker.js)

2. Navigate to the Console tab in DevTools

3. Copy and paste the entire contents of the script you want to run

4. Press Enter to execute the script

5. Review the results in the console

## Available Diagnostic Scripts

### 1. headline-checker.js
Analyzes the NYTimes page to check if headline selectors are working correctly.
- **Run on**: nytimes.com
- **What it checks**:
  - If headline selectors (h1, h2) are finding elements
  - Which elements are good candidates for neutralization
  - How many dynamic headline changes occur
  - Page load timing information

### 2. api-checker.js
Tests the communication with Anthropic's Claude API.
- **Run on**: Any page where the extension is active
- **What it checks**:
  - If the API key is configured
  - If the API responds correctly to a test headline
  - Current daily API call count
  - When the daily limit will reset

### 3. extension-checker.js
Checks the extension's core functionality.
- **Run on**: Any page where the extension is active
- **What it checks**:
  - Message passing between content script and background script
  - Chrome storage functionality
  - Extension permissions
  - Service worker status

## Interpreting Results

Each diagnostic script will output detailed information to the console. Look for:

- ✅ Success indicators
- ❌ Error indicators
- ⚠️ Warning indicators

The most important section is the "Diagnostic Summary" at the end of each test, which provides an overview of whether the extension is functioning correctly.

## Common Issues

1. **Message passing failures**: Indicates the background script isn't running or has been invalidated
2. **API failures**: Check your API key and network connectivity
3. **Storage failures**: The extension may not have proper storage permissions
4. **Missing headlines**: The NYTimes DOM structure may have changed

## What to Do with Results

After running these diagnostics, note any failures or warnings. This information will be useful for fixing the extension. In particular:

- If headline selectors aren't finding elements, the content script needs updating
- If API calls fail, check your API key configuration
- If message passing fails, the background script needs attention 