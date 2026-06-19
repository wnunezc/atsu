# ATSU Privacy Policy

Last updated: 2026-06-18

ATSU is a local browser extension for Stack Overflow and the Stack Exchange network. It helps users review visible questions and answers, highlight question links, and generate optional comment drafts.

## Data processed locally

ATSU reads visible page content from supported Stack Exchange pages only when the extension is enabled for that site. This may include visible question text, answer text, tags, post titles, usernames displayed on the page, and comment text boxes.

This processing happens locally in the user's browser. ATSU does not send question text, answer text, comments, usernames, locally tracked question IDs, browsing history, or settings to any external server. ATSU does not request Chrome's `history` permission.

## Data stored locally

ATSU stores configuration in `chrome.storage.local`, including:

- whether ATSU is enabled for a specific Stack Exchange origin;
- enabled or disabled feature flags;
- expected language preferences;
- color profile preferences;
- optional diagnostics mode preference;
- question IDs opened through ATSU-supported Stack Exchange pages, used only to decide whether to show the local `NEW` / `NUEVO` badge.

The extension also supports local JSON export/import of these settings. Exported files are created on the user's device. Imported files are read locally by the extension.

## Data sharing

ATSU does not sell, transfer, or share user data with third parties.

## Network requests

ATSU does not make external network requests for analytics, telemetry, artificial intelligence, advertising, or remote processing.

## Permissions

ATSU uses these Chrome permissions:

- `storage`: stores local extension settings.
- `activeTab`: lets the popup read the active tab context after the user invokes the extension.
- host permissions for Stack Overflow and Stack Exchange domains: allows the content script to run only on supported sites.

## Limited Use statement

ATSU uses page content only to provide user-facing features: local diagnostics, local heuristics, visual highlighting, and optional comment drafting. The extension does not use this data for advertising, profiling, resale, or unrelated purposes.

## User control

Users can disable ATSU per site, reset a site's settings, reset all settings, or remove the extension from Chrome.

## Official Chrome Web Store references

https://developer.chrome.com/docs/webstore/program-policies/privacy
https://developer.chrome.com/docs/webstore/program-policies/limited-use
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
