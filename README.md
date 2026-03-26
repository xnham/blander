# Blander — News Headline Neutralizer

A Chrome extension that neutralizes sensationalist headlines on nytimes.com using Anthropic's Claude AI (claude-haiku-4-5). Emotional language and partisan framing are replaced with neutral, factual statements while preserving all original information, casing style, and proper nouns.

## Features

- Automatically detects and neutralizes headlines on nytimes.com
- Preserves all factual information while removing emotional language
- Preserves original headline casing, abbreviations, acronyms, and proper nouns
- Works with dynamic content and handles NYT's content refreshes
- Persistent caching of neutralized headlines (48-hour expiration)
- Efficient batch processing of multiple headlines in a single API call
- Simple on/off toggle in the popup
- Blue dot indicator on neutralized headlines (click to restore original)

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** in the top right
4. Click **Load unpacked** and select the project directory
5. The extension will appear in your Chrome toolbar

## Configuration

1. Create a `.env` file in the project root:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
2. Run the build script to generate `config.js`:
   ```bash
   ./build.sh
   ```
3. Reload the extension in `chrome://extensions/`

Alternatively, copy `config.example.js` to `config.js` and replace the placeholder key manually.

## Usage

1. Visit nytimes.com
2. Headlines are automatically neutralized when the extension is enabled
3. Toggle on/off using the toolbar popup
4. Click the blue dot next to any headline to restore the original text

## Daily API Limit

The extension enforces a daily limit of **50 API calls** to manage Claude API usage. Each call can neutralize up to 10 headlines via batch processing, and results are cached for 48 hours across tabs and sessions.

## Debug Logging

Both `content.js` and `background.js` include a `DEBUG` flag (default `false`). Set it to `true` to enable verbose console logging for development and troubleshooting. Error logging (`console.error`) is always active regardless of the flag.

## Privacy

- Your API key lives in `.env` / `config.js` (both gitignored) and never leaves your machine
- Headlines are sent to the Anthropic Claude API for neutralization
- No tracking or analytics are collected
