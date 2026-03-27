# Privacy Policy — Blander | News Headline Neutralizer

**Last updated:** March 27, 2026

## Overview

Blander is a Chrome extension that rewrites New York Times headlines into neutral, factual language using Anthropic's Claude AI. This privacy policy explains what data the extension accesses, how it is used, and how it is stored.

## Data Collection

Blander does **not** collect, store, or transmit any personal information. There are no user accounts, no analytics, and no tracking of any kind.

## Data the Extension Accesses

- **Headline text from nytimes.com:** The extension reads headline elements on New York Times web pages in order to rewrite them. This text is sent to the Anthropic API for processing and is not stored on any server controlled by the extension developer.

- **Your Anthropic API key:** You provide your own API key through the extension's options page. This key is stored locally on your device using Chrome's storage API (`chrome.storage.local`) and is never transmitted anywhere other than directly to the Anthropic API to authenticate your requests.

## Third-Party Services

The extension sends headline text to **Anthropic's API** (`api.anthropic.com`) for AI-powered rewriting. Anthropic's handling of this data is governed by [Anthropic's Privacy Policy](https://www.anthropic.com/privacy) and [API Terms of Service](https://www.anthropic.com/api-terms).

No other third-party services are used.

## Local Storage

The extension stores the following data locally on your device:

- Your Anthropic API key
- A count of neutralized headlines
- Daily API usage statistics
- Cached headline rewrites (to reduce redundant API calls)

This data never leaves your device (except for API requests to Anthropic as described above).

## Permissions

- **Host permission (`nytimes.com`):** Required to read and modify headline text on New York Times pages.
- **Host permission (`api.anthropic.com`):** Required to send headline text to the Anthropic API for rewriting.
- **Storage:** Required to save your API key, usage statistics, and cached results locally.
- **Alarms:** Required to manage the daily API usage limit reset.

## Data Sharing

Blander does not sell, share, or transfer any user data to third parties, other than sending headline text to the Anthropic API as described above.

## Changes to This Policy

If this policy is updated, the changes will be posted here with a revised date.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/wendyham/blander).
