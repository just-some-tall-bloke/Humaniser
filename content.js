let enabled = null;
let homophones = false;

chrome.storage.sync.get({ enabled: true, homophones: false }, (res) => {
  enabled = res.enabled;
  homophones = res.homophones;
  updateButtonVisibility();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    enabled = changes.enabled.newValue;
    updateButtonVisibility();
  }
  if (changes.homophones) homophones = changes.homophones.newValue;
});

const STYLE_ID = "hm-style";

// Single source of truth for locating the compose body. Gmail's aria-labels
// are locale-dependent; g_editable is the locale-independent fallback.
const BODY_SELECTOR =
  '[aria-label="Message Body"][role="textbox"],' +
  '[contenteditable="true"][aria-label*="Body"],' +
  '[contenteditable="true"][aria-label*="body"],' +
  '[contenteditable="true"][g_editable="true"]';

// Words, allowing internal apostrophes ("it's", "they're") but not leading
// or trailing ones (quotes).
const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent =
    `[data-hm-btn]{display:inline-flex;align-items:center;cursor:pointer;` +
    `margin:0 4px;padding:5px 12px;border-radius:20px;border:1px solid #dadce0;` +
    `background:#fff;color:#3c4043;font:500 12px/1 'Google Sans',Roboto,Arial,sans-serif;` +
    `user-select:none;white-space:nowrap;letter-spacing:.2px}` +
    `[data-hm-btn]:hover{background:#f8f9fa}` +
    `[data-hm-btn].hm-done{border-color:#188038;color:#188038}` +
    `[data-hm-btn].hm-miss{border-color:#d93025;color:#d93025}` +
    `[data-hm-btn].hm-undo{border-color:#f9ab00;color:#f9ab00}`;
  document.head.appendChild(s);
}

function updateButtonVisibility() {
  document.querySelectorAll("[data-hm-btn]").forEach((btn) => {
    btn.style.display = enabled ? "" : "none";
  });
}

function getComposeDialogs() {
  const bodies = document.querySelectorAll(BODY_SELECTOR);
  const dialogs = [];
  bodies.forEach((body) => {
    const dialog = body.closest('[role="dialog"]') || body.closest('[role="tabpanel"]');
    if (dialog && !dialogs.some((d) => d === dialog)) dialogs.push(dialog);
  });
  return dialogs;
}

function typosFor(word) {
  const safe = TYPOS[word] || [];
  const risky = homophones ? HOMOPHONES[word] || [] : [];
  const all = safe.concat(risky);
  return all.length ? all : null;
}

function matchCase(orig, typo) {
  if (orig === orig.toUpperCase() && orig.length > 1) return typo.toUpperCase();
  if (/^[A-Z]/.test(orig)) return typo.charAt(0).toUpperCase() + typo.slice(1);
  return typo;
}

// Replace oldText at node[index] with newText. Prefers execCommand so the
// edit lands on Gmail's native undo stack (Ctrl+Z works); falls back to a
// direct textContent splice. Preserves the user's caret. Returns the
// location of the inserted text, or null on failure.
function replaceRange(body, node, index, oldText, newText) {
  if (node.textContent.substr(index, oldText.length) !== oldText) return null;

  const sel = window.getSelection();
  let caret = null;
  if (sel && sel.rangeCount && body.contains(sel.anchorNode)) {
    caret = { node: sel.anchorNode, offset: sel.anchorOffset };
  }

  let loc = null;
  try {
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + oldText.length);
    sel.removeAllRanges();
    sel.addRange(range);
    if (document.execCommand("insertText", false, newText)) {
      // execCommand may split/replace the text node; recover the location
      // from the post-insert selection (collapsed after the inserted text).
      const a = sel.anchorNode;
      const start = sel.anchorOffset - newText.length;
      if (
        a &&
        a.nodeType === Node.TEXT_NODE &&
        start >= 0 &&
        a.textContent.substr(start, newText.length) === newText
      ) {
        loc = { node: a, index: start };
      } else {
        loc = { node: null, index: -1 };
      }
    }
  } catch (err) {
    loc = null;
  }

  if (!loc) {
    const text = node.textContent;
    node.textContent = text.slice(0, index) + newText + text.slice(index + oldText.length);
    loc = { node, index };
    body.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  }

  if (caret && caret.node.isConnected) {
    const max =
      caret.node.nodeType === Node.TEXT_NODE
        ? caret.node.length
        : caret.node.childNodes.length;
    const range = document.createRange();
    range.setStart(caret.node, Math.min(caret.offset, max));
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  return loc;
}

function humaniseDraft(body) {
  if (!enabled) return { ok: false };

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const candidates = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (const m of node.textContent.matchAll(WORD_RE)) {
      if (m[0].length < 2) continue;
      const typos = typosFor(m[0].toLowerCase());
      if (typos) candidates.push({ node, index: m.index, word: m[0], typos });
    }
  }
  if (candidates.length === 0) return { ok: false };

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const typo = matchCase(pick.word, pick.typos[Math.floor(Math.random() * pick.typos.length)]);

  const loc = replaceRange(body, pick.node, pick.index, pick.word, typo);
  if (!loc) return { ok: false };

  return { ok: true, body, word: pick.word, typo, node: loc.node, index: loc.index };
}

// Swap the typo back to the original word. Only touches the typo itself,
// never surrounding text the user may have edited since. Tries the exact
// recorded location first; falls back to searching for the typo string.
function undoDraft(info) {
  if (
    info.node &&
    info.node.isConnected &&
    info.node.textContent.substr(info.index, info.typo.length) === info.typo
  ) {
    return !!replaceRange(info.body, info.node, info.index, info.typo, info.word);
  }
  const walker = document.createTreeWalker(info.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const index = node.textContent.indexOf(info.typo);
    if (index !== -1) {
      return !!replaceRange(info.body, node, index, info.typo, info.word);
    }
  }
  return false;
}

function makeButton(dialog) {
  const btn = document.createElement("div");
  btn.setAttribute("data-hm-btn", "");
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  btn.title = "Humaniser: insert one common typo";
  btn.textContent = "✎ Humanise";

  let undoInfo = null;
  let undoTimeout = null;

  function reset() {
    undoInfo = null;
    clearTimeout(undoTimeout);
    btn.textContent = "✎ Humanise";
    btn.classList.remove("hm-done", "hm-miss", "hm-undo");
  }

  // Keep focus and selection in the compose body so the caret survives the
  // click and execCommand targets the right document position.
  btn.addEventListener("mousedown", (e) => e.preventDefault());

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (undoInfo) {
      undoDraft(undoInfo);
      reset();
      return;
    }
    const body = dialog.querySelector(BODY_SELECTOR);
    if (!body) return;
    const result = humaniseDraft(body);
    btn.classList.remove("hm-done", "hm-miss", "hm-undo");
    if (result.ok) {
      undoInfo = result;
      btn.textContent = "↩ Undo";
      btn.classList.add("hm-undo");
      clearTimeout(undoTimeout);
      undoTimeout = setTimeout(reset, 8000);
    } else {
      btn.textContent = "✗ No matches";
      btn.classList.add("hm-miss");
      setTimeout(reset, 1200);
    }
  });

  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      btn.click();
    }
  });

  return btn;
}

function injectButton(dialog) {
  if (dialog.querySelector("[data-hm-btn]")) return;
  ensureStyles();
  const btn = makeButton(dialog);
  if (!enabled) btn.style.display = "none";

  const sendBtn = dialog.querySelector(
    '[role="button"][data-tooltip*="Send"],' +
    '[role="button"][aria-label*="Send"],' +
    '[role="button"][aria-label*="send"]'
  );

  if (sendBtn && sendBtn.parentElement) {
    sendBtn.parentElement.insertBefore(btn, sendBtn);
    return;
  }

  const toolbar = dialog.querySelector(
    '[role="group"],' +
    '[jscontroller*="Toolbar"],' +
    '[jsname*="toolbar"]'
  );
  if (toolbar) {
    toolbar.appendChild(btn);
    return;
  }

  const bottomArea = dialog.querySelector('[class*="footer"], [jscontroller], [jsaction]');
  if (bottomArea) {
    bottomArea.insertBefore(btn, bottomArea.firstChild);
    return;
  }
}

function tryInject() {
  getComposeDialogs().forEach(injectButton);
}

let observer = null;
let debounceTimer = null;

function start() {
  if (observer) observer.disconnect();

  tryInject();
  setTimeout(tryInject, 1000);

  debounceTimer = null;
  observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tryInject, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: false });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
