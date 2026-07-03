# Humaniser — agent guide

Single-directory extension, no build step. Load at `chrome://extensions` → Load unpacked → select root.

## Key files

| File | Role |
|------|------|
| `content.js` | Compose detection, button injection, typo logic |
| `typos.js` | Global `TYPOS` dict — must be loaded **before** `content.js` in manifest |
| `manifest.json` | MV3, scope `*://mail.google.com/*`, `run_at: document_idle` |

## Important details

- `content.js` initializes `enabled = null`, not `false`. The `enabled === null` guard prevents running before storage is read.
- Button injection polls 30× every 500ms + MutationObserver. Compose detection uses `[role="dialog"]` / `[role="tabpanel"]` fallback selectors. If Gmail's DOM changes, update these selectors.
- Typo candidate picks one random word, one random variation. Subsequent clicks pick different remaining candidates.
- Some typo values contain spaces intentionally (e.g. `"tim e"`, `"mor e"`, `"muc h"`) — these are literal typo strings, not bugs.
- Some `TYPOS` entries swap homophones/near-words (e.g. `affect`↔`effect`, `desert`↔`dessert`). These produce grammar errors not typos — intentional, but riskier in professional contexts.
- Case precedence: all-caps check (`orig === orig.toUpperCase()`) runs first, then title-case. `THE` → `TEH`, not `Teh`.
- Version lives in two places: `manifest.json` and `popup.html` footer. Bump both.
- No tests, no linter, no CI. No build or packaging scripts. Zip manually with `Compress-Archive`.
- `popup.js` uses `chrome.storage.sync` — no message passing needed.

## If button doesn't appear in compose

1. Reload at `chrome://extensions`
2. Open DevTools (`Ctrl+Shift+J`) on Gmail, check console for errors
3. Inspect the compose dialog's DOM — the selectors in `getComposeBody()` and `injectButton()` are the most likely to break on Gmail layout changes
