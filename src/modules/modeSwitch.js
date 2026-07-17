// modeSwitch.js — toggle read / edit mode

const MODE_META = {
  read: { icon: "📖", labelKey: "mode.read", statusKey: "status.read_mode" },
  edit: { icon: "✏️", labelKey: "mode.edit", statusKey: "status.edit_mode" }
};

export function applyMode(mode, i18n) {
  const isEdit = mode === "edit";

  document.getElementById("renderer-output").hidden = isEdit;
  // editor-pane hosts whichever editor is active (Vditor, or the classic
  // textarea as fallback) — app.js decides which child is visible.
  document.getElementById("editor-pane").hidden = !isEdit;

  document.getElementById("mode-icon").textContent = MODE_META[mode].icon;
  const label = document.getElementById("mode-label");
  label.dataset.i18n = MODE_META[mode].labelKey;
  label.textContent = i18n.t(MODE_META[mode].labelKey);

  const statusMode = document.getElementById("status-mode");
  statusMode.dataset.i18n = MODE_META[mode].statusKey;
  statusMode.textContent = i18n.t(MODE_META[mode].statusKey);
}
