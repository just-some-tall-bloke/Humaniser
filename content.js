let enabled = null;

chrome.storage.sync.get({ enabled: true }, (res) => {
  enabled = res.enabled;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) enabled = changes.enabled.newValue;
});

const STYLE_ID = "hm-style";

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
    `[data-hm-btn].hm-busy{border-color:#f9ab00;color:#f9ab00}`;
  document.head.appendChild(s);
}

function getComposeBody() {
  return document.querySelector(
    '[aria-label="Message Body"][role="textbox"],' +
    '[contenteditable="true"][aria-label*="Body"],' +
    '[contenteditable="true"][aria-label*="body"],' +
    '[contenteditable="true"][g_editable="true"]'
  );
}

function getComposeDialogs() {
  const bodies = document.querySelectorAll(
    '[aria-label="Message Body"][role="textbox"],' +
    '[contenteditable="true"][aria-label*="Body"],' +
    '[contenteditable="true"][aria-label*="body"],' +
    '[contenteditable="true"][g_editable="true"]'
  );
  const dialogs = [];
  bodies.forEach((body) => {
    const dialog = body.closest('[role="dialog"]') || body.closest('[role="tabpanel"]');
    if (dialog && !dialogs.some((d) => d === dialog)) dialogs.push(dialog);
  });
  return dialogs;
}

function humaniseDraft(body) {
  if (enabled === null || !enabled) return false;

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent.trim()) textNodes.push(node);
  }

  const candidates = [];
  textNodes.forEach((node) => {
    const parts = node.textContent.split(/\b/);
    parts.forEach((part, i) => {
      const lower = part.toLowerCase().trim();
      const clean = lower.replace(/[^\w']/g, "");
      if (TYPOS[clean] && clean.length > 1 && !/^\d+$/.test(clean)) {
        candidates.push({ node, partIndex: i, word: part, lower: clean, typos: TYPOS[clean] });
      }
    });
  });

  if (candidates.length === 0) return false;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const typo = pick.typos[Math.floor(Math.random() * pick.typos.length)];
  const parts = pick.node.textContent.split(/\b/);
  const orig = parts[pick.partIndex];

  if (orig === orig.toUpperCase() && orig.length > 1) {
    parts[pick.partIndex] = typo.toUpperCase();
  } else if (/^[A-Z]/.test(orig)) {
    parts[pick.partIndex] = typo.charAt(0).toUpperCase() + typo.slice(1);
  } else {
    parts[pick.partIndex] = typo;
  }

  pick.node.textContent = parts.join("");

  const sel = window.getSelection();
  if (sel && body.contains(sel.anchorNode)) {
    const range = document.createRange();
    range.setStart(sel.anchorNode, sel.anchorOffset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  body.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  return true;
}

function makeButton(dialog) {
  const btn = document.createElement("div");
  btn.setAttribute("data-hm-btn", "");
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  btn.title = "Humaniser: insert one common typo";
  btn.textContent = "✎ Humanise";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const body = dialog.querySelector(
      '[aria-label="Message Body"][role="textbox"],' +
      '[contenteditable="true"][g_editable="true"]'
    );
    if (!body) return;
    const applied = humaniseDraft(body);
    btn.classList.remove("hm-done", "hm-miss");
    if (applied) {
      btn.textContent = "✓ Done";
      btn.classList.add("hm-done");
    } else {
      btn.textContent = "✗ No matches";
      btn.classList.add("hm-miss");
    }
    setTimeout(() => {
      btn.textContent = "✎ Humanise";
      btn.classList.remove("hm-done", "hm-miss");
    }, 1200);
  });

  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
  });

  return btn;
}

function injectButton(dialog) {
  if (dialog.querySelector("[data-hm-btn]")) return;
  ensureStyles();
  const btn = makeButton(dialog);

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

  for (let i = 0; i < 30; i++) setTimeout(tryInject, i * 500);

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
