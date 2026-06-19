# ATSU Rescue and Initial Release Report

## Summary

ATSU has moved from a rescue build into initial version `1.0.0`. The extension has a Manifest V3 base, restricted host permissions, a compact popup, local diagnostics, smarter templates, portable settings, and publication-preparation documentation.

The initial engineering audit was followed by stabilization work that centralized configuration validation, serialized visited-question writes, coordinated dynamic DOM updates, improved keyboard accessibility, and added repeatable automated verification.

## What was rescued

- Stack Exchange site targeting.
- Per-site configuration model.
- Question link highlighting.
- Comment assistant concept.
- Local heuristic quality checks.
- English/Spanish usage.
- Existing media assets and license file.

## Major fixes from the legacy extension

- Removed broad permissions such as cookies, history, bookmarks, and all-URLs patterns.
- Removed fragile behavior that replaced native Stack Exchange sidebars.
- Centralized selector handling in the content script.
- Rebuilt popup UI.
- Added answer-aware comments.
- Added Meta-aware question comments.
- Added local settings import/export.
- Added privacy and store-readiness documentation.

## Implemented requested items

### 2. Diagnostics mode

Added `debug` configuration. When enabled, the sidebar ATSU panel shows detected state:

- site;
- mode;
- page;
- language;
- question/answer/comment counts;
- suggestion count;
- new post count.

### 3. Smarter templates

Added smarter templates for:

- technical questions;
- answers;
- Meta/support/discussion posts.

Defaults are limited using `commentMaxSuggestions` to avoid overlong comments.

### 4. Compact popup UI

Replaced the long single-column popup with tabs:

- General;
- Comments;
- Colors;
- Data.

### 5. Color profiles

Added profiles:

- none;
- soft;
- medium;
- strong;
- custom.

### 6. Import/export configuration

Added local JSON export/import and reset-all behavior through background service worker messages.

### 7. Privacy and publication preparation

Added:

- `PRIVACY_POLICY.md`;
- `STORE_PREP.md`;
- updated `README.md`;
- `CHANGELOG.md`.

## Remaining manual validation

Test manually on:

- Stack Overflow English question page;
- Stack Overflow English answer comment;
- Meta Stack Overflow question page;
- Stack Overflow en español question page;
- Stack Overflow en español answer comment;
- es.meta.stackoverflow.com;
- Super User;
- Server Fault;
- Ask Ubuntu;
- MathOverflow.

## Official references

https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
https://developer.chrome.com/docs/webstore/program-policies/policies
https://developer.chrome.com/docs/webstore/program-policies/privacy
https://developer.chrome.com/docs/webstore/program-policies/limited-use
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
