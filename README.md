# Blander — News Headline Neutralizer

A Chrome extension that neutralizes sensationalist headlines on nytimes.com using Anthropic's Claude AI (claude-haiku-4-5). Emotional language and partisan framing are replaced with dry, deadpan, and slightly absurd rewrites — like mundane bureaucratic memos about dramatic events — while preserving all original information, casing style, and proper nouns. After the model responds, a small **casing normalizer** (`casing.js`) adjusts capitalization so headlines match the original’s sentence case vs title case (for example fixing all-lowercase API output) without turning intentional sentence-style rewrites into full title case.

## Features

- Automatically detects and neutralizes headlines on the **nytimes.com homepage** only (not article pages or other URLs)
- Covers the main story area, NEWS well-section grid, the **Watch Today's Videos** carousel (`video-feed-scroll` / `feed-item`), **egyhip**-styled headline paragraphs (including when `egyhip` appears on the `p` but not the parent wrapper), and dynamically loaded content
- Rewrites headlines at a 3rd-grade reading level with a dry, absurdist tone while preserving factual information
- Preserves original headline casing (with deterministic post-processing when the model drifts), abbreviations, acronyms, and proper nouns
- Works with dynamic and lazy-rendered content via mutation observer and scroll detection
- Persistent caching of neutralized headlines (48-hour expiration)
- Efficient batch processing of multiple headlines in a single API call
- Simple on/off toggle in the popup
- Blue dot indicator on headlines whose text was actually rewritten

## Installation

### Chrome Web Store

Install Blander directly from the [Chrome Web Store](https://chrome.google.com/webstore) (coming soon). The options page will open automatically on first install so you can enter your API key.

Listing graphics (marquee tile, small promo tile, and screenshot) live under `images/store/`.

### Manual / Developer Install

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** in the top right
4. Click **Load unpacked** and select the project directory
5. The extension will appear in your Chrome toolbar

## Configuration

Open the extension's **Options page** (right-click the toolbar icon → Options) and enter your Anthropic API key. The key is stored locally via `chrome.storage.local` and never leaves your device.

## Usage

1. Open the nytimes.com homepage (`/` — not individual articles)
2. Headlines on that page are automatically neutralized when the extension is enabled
3. Toggle on/off using the toolbar popup
4. Click any headline to open the article and see the original text

## Daily API Limit

The extension enforces a daily limit of **50 API calls** to manage Claude API usage. Each call can neutralize up to 10 headlines via batch processing, and results are cached for 48 hours across tabs and sessions.

## Cost Tracking

The Options page displays estimated API costs based on actual token usage reported by the Anthropic API. Both daily and all-time totals are shown, along with a token-level breakdown. Cost estimates use Claude Haiku 4.5 pricing ($1/MTok input, $5/MTok output). Daily token counters reset alongside the daily API call counter at midnight.

## Error Recovery

The extension handles two classes of runtime errors:

- **Transient failures** (service worker timeout, message channel closed) — failed headlines are automatically re-queued for retry on the next processing cycle.
- **Permanent context invalidation** (extension reloaded or updated while a tab is open) — the content script detects this, stops all processing, and shows a small banner prompting the user to reload the page.

The MV3 service worker is kept alive during active API calls via a periodic keepalive ping, preventing Chrome from terminating it mid-request.

## Debug Logging

Both `content.js` and `background.js` include a `DEBUG` flag (default `false`). Set it to `true` to enable verbose console logging for development and troubleshooting. Error logging (`console.error`) is always active regardless of the flag.

## Chrome Web Store package (`blander-extension.zip`)

For store submission, build the zip locally from the project root (it is gitignored and not pushed to GitHub):

```bash
zip -r blander-extension.zip manifest.json background.js casing.js content.js \
  popup.html popup.js options.html options.js \
  images/bored16.png images/bored48.png images/bored128.png
```

Upload that file in the Chrome Web Store Developer Dashboard. End users set the API key in **Options** after install.

## Privacy

- Your API key is stored in `chrome.storage.local` on your device and never leaves your machine.
- Headlines are sent to the Anthropic Claude API for neutralization — no other third-party services are contacted
- No tracking, analytics, or telemetry of any kind are collected
- The content script runs on `nytimes.com`, but headline rewriting runs only on the homepage (`/`)
