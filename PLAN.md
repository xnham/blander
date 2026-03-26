# Blander: Full Codebase Improvement Plan

All phases complete. This document records the changes made from the original `discharge` codebase to the current `blander` extension.

---

## Phase 1: Critical Fixes

- **1a**: API key secured via `.env` + `build.sh` + `config.js` (gitignored). `background.js` uses `importScripts('config.js')`.
- **1b**: Deleted `toTitleCase` function and both call sites. Updated both Claude system prompts to preserve original casing style, abbreviations, acronyms, and proper nouns.
- **1c**: Fixed double-decrement of `processingCount` and erroneous `dailyApiCalls` increment on error. Moved counter updates to success-only path in both `neutralizeBatch` and `neutralizeText`. Fixed misleading comment on `MAX_DAILY_API_CALLS`.
- **1d**: Upgraded Claude model from `claude-3-haiku-20240307` to `claude-haiku-4-5` in both API calls.

## Phase 2: High Priority Fixes

- **2a**: Unified daily API call limit to 50 across `background.js`, `options.js`, and `options.html`.
- **2b**: Replaced dead `fromSelf` check with module-scoped `ignoringNextCacheChange` flag in `content.js`.
- **2c**: Merged duplicate `onMessage` and `onAlarm` listeners in `background.js` into single unified listeners.
- **2d**: Switched batch response format to JSON array with numbered-list regex fallback in `neutralizeBatch`.
- **2e**: Added early return in `initialize()` when `pathname !== '/'` to restrict processing to the NYTimes homepage only.

## Phase 3: Performance Overhaul

- **3a**: Replaced `isProcessing` gate + 15s `setInterval` with continuous batch queue (`pendingQueue`, `pendingTexts`, `queueProcessing`). `scanForHeadlines()` replaces `findAndNeutralizeHeadlines()`, populates queue and kicks off `processQueue()`. Removed `neutralizeHeadline()` (absorbed into queue). Fallback interval increased to 30s.
- **3b**: Increased `MAX_BATCH_SIZE` from 5 to 10, `max_tokens` from 1000 to 2000.
- **3c**: Reduced `API_THROTTLE_DELAY` from 1000ms to 200ms.
- **3d**: Reduced observer debounce from 500ms to 200ms, removed nested 100ms `setTimeout`, removed `requestAnimationFrame` wrapper in `applyAllCachedHeadlines`, reduced initialization delay from 1000ms to 200ms.

## Phase 4: Medium Priority Cleanup

- Removed `updateNeutralizationCounter` no-op and call site.
- Consolidated `isHeadlineCached` + `getCachedHeadline` into single `findCachedHeadline(text)` returning `string | null`.
- Tracked `cleanupInterval` and `contextCheckInterval` in module scope to prevent duplicate intervals on recovery.
- Replaced `window.updateTimeout` with module-scoped `debounceTimer`.
- Added in-memory `headlineCache` Map pruning inside `cleanupExpiredCache`.
- Removed redundant indicator cleanup in `restoreOriginalHeadline` (setting `textContent` already destroys child nodes).

## Phase 5: UX Refinements

- Removed click-to-restore on the blue indicator dot. Users can click the headline link to see the original text on the article page. The indicator now serves as a passive visual marker with a tooltip ("Neutralized by Blander"). Bulk restore when the extension is toggled off is unchanged.

## Phase 6: Low Priority

- Removed unused `activeTab` permission from manifest.
- Added `DEBUG` flag (default `false`) in both `content.js` and `background.js`; all verbose `console.log` calls gated behind it while `console.error` remains unconditional.
- Removed `images/placeholder.txt` (real icon files already present).

## Phase 7: Rebrand, Docs, and Git Init

- Rebranded manifest, popup, and options UI from "Discharge" to "Blander".
- Created `.gitignore`, `README.md`, and `PLAN.md`.
- Renamed project folder from `discharge` to `blander`.
- Initialized git repository and pushed to `github.com/xnham/blander`.
