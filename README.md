# Humaniser

A Chrome extension that inserts one common typo into Gmail drafts to make them sound more human.

## How it works

Click the **✎ Humanise** button in the compose toolbar to randomly replace one word in your draft with a common typo. The typo is chosen from a curated map of ~230 common misspellings (e.g. `the → teh`, `email → emial`, `meeting → meetig`).

## Why

AI-generated drafts are too clean. One well-placed typo makes text feel natural and unpolished.

## Usage

1. Open Gmail and start composing a message
2. Click **✎ Humanise** in the compose toolbar
3. Repeat to apply a different typo

Toggle the extension on/off via the toolbar icon.

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
