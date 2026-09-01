const toggle = document.getElementById("toggle");
const homToggle = document.getElementById("homophones");
const badge = document.getElementById("statusBadge");

chrome.storage.sync.get({ enabled: true, homophones: false }, (res) => {
  toggle.checked = res.enabled;
  homToggle.checked = res.homophones;
  updateBadge(res.enabled);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled });
  updateBadge(enabled);
});

homToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ homophones: homToggle.checked });
});

function updateBadge(on) {
  badge.textContent = on ? "ON" : "OFF";
  badge.className = "badge" + (on ? "" : " off");
}
