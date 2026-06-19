# ATSU Chrome Web Store Preparation Notes

This file documents the current publication-readiness state of ATSU 1.0.0.

## Current status

ATSU 1.0.0 includes automated static, unit, security, and isolated Chromium smoke validation. Chrome Web Store acceptance still depends on final listing text, screenshots, owner account details, privacy declarations, and manual checks against live Stack Exchange pages by the publisher.

## Implemented publication improvements

- Manifest V3.
- Reduced permissions: `storage` and `activeTab` only.
- Host permissions limited to Stack Overflow, Stack Exchange, Super User, Server Fault, Ask Ubuntu, Stack Apps, and MathOverflow domains.
- No broad `*://*/*` permission.
- No cookies/history/bookmarks permission.
- No external analytics.
- No remote AI processing.
- Local settings export/import.
- Privacy policy draft included in `PRIVACY_POLICY.md`.
- Automated checks for settings, storage concurrency, dynamic DOM behavior, keyboard accessibility, secrets, and Manifest V3 loading.

## Chrome Web Store checklist

Before publication, verify:

1. The extension name and description are accurate.
2. Screenshots show the popup, question panel, comment assistant, diagnostics mode, and color profiles.
3. The privacy policy is published on a reachable URL, not only inside the ZIP.
4. The privacy tab accurately declares local processing and storage.
5. The listing clearly explains that ATSU analyzes visible Stack Exchange page content locally.
6. The extension is tested on at least:
   - https://stackoverflow.com
   - https://meta.stackoverflow.com
   - https://es.stackoverflow.com
   - https://es.meta.stackoverflow.com
   - https://superuser.com
   - https://serverfault.com
   - https://askubuntu.com
   - https://stackapps.com
   - https://mathoverflow.net

## Suggested listing summary

ATSU is a local toolkit for Stack Overflow and Stack Exchange users. It highlights question links, detects common post-quality issues, offers local diagnostics, and helps draft helpful comments for questions and answers. All analysis runs locally in the browser.

## Official references

https://developer.chrome.com/docs/webstore/program-policies/policies
https://developer.chrome.com/docs/webstore/program-policies/privacy
https://developer.chrome.com/docs/webstore/program-policies/limited-use
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
