// welcomeScreen.js — empty-state welcome screen

export function renderWelcome(i18n, recentFiles, onPickRecent) {
  const recent = recentFiles && recentFiles.length > 0;
  const html = `
    <div class="welcome">
      <h1>${escapeHtml(i18n.t("welcome.title"))}</h1>
      <p class="welcome-hint">${escapeHtml(i18n.t("welcome.hint"))}</p>
      <h3>${escapeHtml(i18n.t("welcome.recent"))}</h3>
      ${recent ? `
        <ul class="welcome-recent">
          ${recentFiles.map(p => {
            const name = p.split(/[\\/]/).pop();
            return `<li data-path="${escapeAttr(p)}">${escapeHtml(name)}<small>${escapeHtml(p)}</small></li>`;
          }).join("")}
        </ul>
      ` : `
        <p style="color:var(--text-tertiary);font-size:13px;">${escapeHtml(i18n.t("welcome.no_recent"))}</p>
      `}
    </div>
  `;
  const output = document.getElementById("renderer-output");
  output.innerHTML = html;
  output.querySelectorAll(".welcome-recent li").forEach(li => {
    li.addEventListener("click", () => onPickRecent?.(li.dataset.path));
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

function escapeAttr(s) {
  return escapeHtml(s);
}
