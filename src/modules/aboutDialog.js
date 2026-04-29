// aboutDialog.js

const VERSION = "1.1.0";

export class AboutDialog {
  constructor(i18n) {
    this.i18n = i18n;
  }

  show() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${escapeHtml(this.i18n.t("about.title"))}</h2>
        <p>${escapeHtml(this.i18n.t("about.version", { version: VERSION }))}</p>
        <p>${escapeHtml(this.i18n.t("about.tagline"))}</p>
        <p style="font-size:12px;color:var(--text-tertiary);">${escapeHtml(this.i18n.t("about.author"))}</p>
        <div class="modal-actions">
          <button class="modal-btn modal-close-btn">${escapeHtml(this.i18n.t("dialog.ok"))}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector(".modal-close-btn").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", esc);
      }
    });
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
