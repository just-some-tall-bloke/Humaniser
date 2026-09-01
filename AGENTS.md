# Humaniser — agent guide

Single-directory extension, no build step. Load at `chrome://extensions` → Load unpacked → select root.

## Key files

| File | Role |
|------|------|
| `content.js` | Compose detection, button injection, typo logic |
| `typos.js` | Global `TYPOS` (safe) + `HOMOPHONES` (risky, opt-in) dicts — must be loaded **before** `content.js` in manifest |
| `manifest.json` | MV3, scope `*://mail.google.com/*`, `run_at: document_idle` |

## Important details

- `content.js` initializes `enabled = null`, not `false`. Buttons stay hidden (`display:none`) until storage reports enabled; `humaniseDraft` also guards on `!enabled`.
- Two dicts: `TYPOS` (safe misspellings) always active; `HOMOPHONES` (meaning-changing swaps like `their`↔`there`, `desert`↔`dessert`) merged in only when the `homophones` storage flag is on (popup toggle, default off). No US/UK dialect swaps and no space-inserting typo strings — culled in v1.2 as low-quality.
- The compose body selector lives in one constant: `BODY_SELECTOR` in `content.js`. Never duplicate it inline.
- Word scanning uses `WORD_RE` (`matchAll`), which keeps internal apostrophes — `it's` / `they're` match as single words.
- Replacement goes through `replaceRange()`: `execCommand("insertText")` first (keeps Gmail's native Ctrl+Z undo working), `textContent` splice + synthetic `input` event as fallback. It saves/restores the user's caret with offset clamping.
- Undo (`undoDraft`) replaces only the typo string — exact recorded location first, text search fallback — so user edits made after the insert survive.
- Button injection: 2 initial tries (0ms, 1s) + MutationObserver (250ms debounce). Compose detection uses `[role="dialog"]` / `[role="tabpanel"]` fallback selectors. If Gmail's DOM changes, update `BODY_SELECTOR` and the send-button/toolbar selectors in `injectButton()`.
- Typo candidate picks one random word, one random variation. Subsequent clicks pick different remaining candidates.
- Case precedence (`matchCase`): all-caps check (`orig === orig.toUpperCase()`) runs first, then title-case. `THE` → `TEH`, not `Teh`.
- Version lives in two places: `manifest.json` and `popup.html` footer. Bump both.
- No tests, no linter, no CI. No build or packaging scripts. Zip manually with `Compress-Archive`.
- `popup.js` uses `chrome.storage.sync` — no message passing needed. Keys: `enabled` (bool, default true), `homophones` (bool, default false).

## If button doesn't appear in compose

1. Reload at `chrome://extensions`
2. Open DevTools (`Ctrl+Shift+J`) on Gmail, check console for errors
3. Inspect the compose dialog's DOM — `BODY_SELECTOR` and the selectors in `injectButton()` are the most likely to break on Gmail layout changes
