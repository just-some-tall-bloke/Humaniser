# Humaniser

A Chrome extension that inserts one common typo into Gmail drafts to make them sound more human.

## How it works

Click the **✎ Humanise** button in the compose toolbar to randomly replace one word in your draft with a common typo. The typo is chosen from a curated map of ~220 common misspellings (e.g. `the → teh`, `email → emial`, `meeting → meetig`), plus an opt-in set of ~30 homophone swaps.

## Why

AI-generated drafts are too clean. One well-placed typo makes text feel natural and unpolished.

## Usage

1. Open Gmail and start composing a message
2. Click **✎ Humanise** in the compose toolbar
3. Repeat to apply a different typo

Toggle the extension on/off via the toolbar icon. A second toggle enables **homophone swaps** (`their → there`, `accept → except`) — these pass spellcheck and change meaning, so they are off by default.

Inserted typos land on Gmail's native undo stack, so **Ctrl+Z** reverts them; the button also turns into **↩ Undo** for 8 seconds after each insert.

## Known limitations

- English Gmail UI only: compose detection relies on the `aria-label="Message Body"` attribute (with a `g_editable` fallback). Localized Gmail may not be detected.
- Gmail DOM changes can break the compose/toolbar selectors; see `AGENTS.md` for which ones to update.

## Install

### From source (development)
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

### Chrome Web Store
*(not yet published)*

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (MV3) |
| `content.js` | Compose detection + typo injection |
| `typos.js` | Word-to-typo mapping dictionary |
| `popup.html` / `popup.js` | On/off toggle UI |
| `icons/` | Extension icons (16, 48, 128) |
