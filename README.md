# ATSU 1.0.0

ATSU is an Advanced Toolkit for Stack Overflow and Stack Exchange users. Version 1.0.0 focuses on safer permissions, local-only analysis, diagnostics, visual question indicators, and useful comment assistance.

## Main features

- Manifest V3 extension.
- Runs only on supported Stack Overflow / Stack Exchange domains.
- Per-site enable/disable configuration.
- Local heuristic review of questions and answers.
- Question, answer, and Meta-specific comment templates.
- Comment assistant button near Stack Exchange comment boxes.
- Local diagnostics mode for selector and page-state debugging.
- Question-link highlighting with color profiles.
- `NEW` / `NUEVO` badges for questions ATSU has not seen you open yet.
- `CLOSED` / `CERRADA` badges for titles marked `[closed]`, `[duplicate]`, `[cerrada]`, or `[duplicada]`.
- Import/export of ATSU settings as local JSON.
- No external analytics, telemetry, or remote AI processing.

## Installation in Chrome Developer Mode

1. Unzip the package.
2. Open Chrome.
3. Go to:

```text
chrome://extensions/
```

4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the `atsu` folder.
7. Open a supported Stack Exchange page and enable ATSU from the popup.

## Development and verification

The extension runs directly from source and does not require a production build.

```text
npm install
npm run verify
```

`npm run verify` checks JavaScript syntax, JSON files, the public `1.0.0` version, tracked files for common secrets, unit tests, and an isolated headless-Chromium smoke test.

Runtime files:

- `background.js`;
- `src/js/shared/config.js` and `src/js/shared/storage.js`;
- `src/js/content.js`;
- `src/js/popup.js`, `src/html/popup.html`, and `src/css/popup.css`.

Reference data:

- `src/json/urls.json`: static catalog snapshot used for documentation and validation, not loaded at runtime;
- `src/json/lang/*.json`: legacy language reference data, not loaded at runtime. Current UI strings live in the JavaScript runtime.

## Recommended test sites

```text
https://stackoverflow.com/questions
https://stackoverflow.com/questions/<id>/<slug>
https://meta.stackoverflow.com/questions/<id>/<slug>
https://es.stackoverflow.com/questions
https://es.stackoverflow.com/questions/<id>/<slug>
https://es.meta.stackoverflow.com/questions/<id>/<slug>
https://superuser.com/questions
https://serverfault.com/questions
https://askubuntu.com/questions
https://stackapps.com/questions
https://mathoverflow.net/questions
```

## Diagnostics mode

Enable **Diagnostics mode** in the popup under the **General** tab. On question pages, the ATSU panel will show detected values such as:

- site name;
- site mode: technical or meta;
- page type;
- expected language;
- question detected;
- answers detected;
- comment boxes detected;
- question links detected;
- generated suggestions.

This mode is meant for testing and selector debugging.

## Comment assistant behavior

ATSU now distinguishes between:

- comments under questions;
- comments under answers;
- technical Stack Overflow pages;
- Meta/support/discussion pages.

On Meta pages, ATSU avoids defaulting to technical `[mre]` comments and uses support/bug/context-oriented prompts instead.

## Color profiles

Available profiles:

- `None`: disables ATSU link highlighting.
- `Soft`: calmer daily-use colors.
- `Medium`: clearer visual distinction.
- `Strong`: high-visibility testing colors.
- `Custom`: manual color pickers.

## Settings portability

Use the **Data** tab in the popup to:

- export settings as JSON;
- import settings from JSON;
- reset all ATSU settings.

Export/import is local only. ATSU does not upload the JSON file.

## Privacy

Read `PRIVACY_POLICY.md` before publication or distribution. The short version:

- ATSU analyzes visible Stack Exchange page content locally.
- ATSU stores only local configuration.
- ATSU does not send content to external servers.
- ATSU does not use analytics or telemetry.

## Official Chrome documentation

https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
https://developer.chrome.com/docs/webstore/program-policies/privacy
https://developer.chrome.com/docs/webstore/program-policies/limited-use
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

### Question badges

ATSU marks dynamically detected questions with a compact `NEW` / `NUEVO` badge before the title. Closed questions are marked with `CLOSED` / `CERRADA` when the Stack Exchange page exposes enough closed-state information in the card markup. This is intentionally less invasive than coloring the entire question card.


## Badge behavior

`NEW` / `NUEVO` means **not visited by you according to ATSU local tracking**. ATSU records question IDs when you click a question link or open a question page. It does not request Chrome's `history` permission, so it cannot import browser visits that happened before the extension was installed.

Closed detection follows explicit title markers when available, including `[closed]`, `[duplicate]`, `[cerrada]`, and `[duplicada]`.
