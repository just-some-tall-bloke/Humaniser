const toggle = document.getElementById("toggle");
const badge = document.getElementById("statusBadge");

chrome.storage.sync.get({ enabled: true }, (res) => {
  toggle.checked = res.enabled;
  updateBadge(res.enabled);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled });
  updateBadge(enabled);
});

function updateBadge(on) {
  badge.textContent = on ? "ON" : "OFF";
  badge.className = "badge" + (on ? "" : " off");
}
