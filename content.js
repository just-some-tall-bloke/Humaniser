let enabled = null;

chrome.storage.sync.get({ enabled: true }, (res) => {
  enabled = res.enabled;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) enabled = changes.enabled.newValue;
});

function getComposeBody() {
  return document.querySelector(
    '[aria-label="Message Body"][role="textbox"],' +
    '[contenteditable="true"][aria-label*="Body"],' +
    '[contenteditable="true"][aria-label*="body"],' +
    '[contenteditable="true"][g_editable="true"]'
  );
}

function getComposeDialog() {
  const body = getComposeBody();
  if (!body) return null;
  return body.closest('[role="dialog"]') || body.closest('[role="tabpanel"]');
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

  if (/^[A-Z]/.test(orig) && orig.length > 1) {
    parts[pick.partIndex] = typo.charAt(0).toUpperCase() + typo.slice(1);
  } else if (orig === orig.toUpperCase() && orig.length > 1) {
    parts[pick.partIndex] = typo.toUpperCase();
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

function makeButton() {
  const btn = document.createElement("div");
  btn.setAttribute("data-hm-btn", "");
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  btn.title = "Humaniser: insert one common typo";
  btn.textContent = "✎ Humanise";
  btn.style.cssText =
    "display:inline-flex;align-items:center;cursor:pointer;" +
    "margin:0 4px;padding:5px 12px;border-radius:20px;border:1px solid #dadce0;" +
    "background:#fff;color:#3c4043;font:500 12px/1 'Google Sans',Roboto,Arial,sans-serif;" +
    "user-select:none;white-space:nowrap;letter-spacing:0.2px;";

  btn.addEventListener("mouseenter", () => { btn.style.background = "#f8f9fa"; });
  btn.addEventListener("mouseleave", () => { btn.style.background = "#fff"; });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const dialog = btn.closest('[role="dialog"]') || btn.closest('[role="tabpanel"]');
    const body = dialog ? dialog.querySelector('[aria-label="Message Body"][role="textbox"], [contenteditable="true"][g_editable="true"]') : getComposeBody();
    if (body) {
      const applied = humaniseDraft(body);
      if (applied) {
        const orig = btn.textContent;
        btn.textContent = "✓ Done";
        btn.style.borderColor = "#188038";
        btn.style.color = "#188038";
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.borderColor = "#dadce0";
          btn.style.color = "#3c4043";
        }, 1200);
      }
    }
  });

  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
  });

  return btn;
}

function injectButton(dialog) {
  if (dialog.querySelector("[data-hm-btn]")) return;
  const btn = makeButton();

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
  const dialog = getComposeDialog();
  if (dialog) injectButton(dialog);
}

let observer = null;

function start() {
  if (observer) observer.disconnect();

  for (let i = 0; i < 30; i++) setTimeout(tryInject, i * 500);

  observer = new MutationObserver(tryInject);
  observer.observe(document.body, { childList: true, subtree: true, attributes: false });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
