// firstRunDialog.js — first-run prompt to set as default .md handler

const KEY_ASKED = "md-reader.firstrun.asked";

export function shouldShowFirstRun() {
  return localStorage.getItem(KEY_ASKED) !== "1";
}

export function markFirstRunDone() {
  localStorage.setItem(KEY_ASKED, "1");
}

export function showFirstRunDialog(i18n, onAccept, onDecline) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const title = i18n.t("firstrun.title");
  const body = i18n.t("firstrun.body");
  const setBtn = i18n.t("firstrun.set_default");
  const skipBtn = i18n.t("firstrun.skip");

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:440px;">
      <h2>${escapeHtml(title)}</h2>
      <p style="font-size:14px;line-height:1.6;">${escapeHtml(body)}</p>
      <div class="modal-actions" style="margin-top:18px;">
        <button class="modal-btn secondary" id="firstrun-skip">${escapeHtml(skipBtn)}</button>
        <button class="modal-btn" id="firstrun-set">${escapeHtml(setBtn)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.querySelector("#firstrun-set").addEventListener("click", () => {
    markFirstRunDone();
    close();
    onAccept?.();
  });
  overlay.querySelector("#firstrun-skip").addEventListener("click", () => {
    markFirstRunDone();
    close();
    onDecline?.();
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
