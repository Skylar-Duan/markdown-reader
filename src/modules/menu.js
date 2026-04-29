// menu.js — top-bar dropdown menus

export function buildMenuConfig(actions) {
  return {
    file: [
      { i18n: "menu.file.open", shortcut: "Ctrl+O", action: () => actions.open() },
      { i18n: "menu.file.save", shortcut: "Ctrl+S", action: () => actions.save() },
      { i18n: "menu.file.save_as", shortcut: "Ctrl+Shift+S", action: () => actions.saveAs() },
      { type: "separator" },
      { i18n: "menu.file.print", shortcut: "Ctrl+P", action: () => actions.print() },
      { type: "separator" },
      { i18n: "menu.file.set_default", action: () => actions.setDefault() },
      { type: "separator" },
      { i18n: "menu.file.close", shortcut: "Ctrl+W", action: () => actions.close() }
    ],
    edit: [
      { i18n: "menu.edit.undo", shortcut: "Ctrl+Z", action: () => actions.undo() },
      { i18n: "menu.edit.redo", shortcut: "Ctrl+Y", action: () => actions.redo() },
      { type: "separator" },
      { i18n: "menu.edit.cut", shortcut: "Ctrl+X", action: () => actions.cut() },
      { i18n: "menu.edit.copy", shortcut: "Ctrl+C", action: () => actions.copy() },
      { i18n: "menu.edit.paste", shortcut: "Ctrl+V", action: () => actions.paste() },
      { i18n: "menu.edit.select_all", shortcut: "Ctrl+A", action: () => actions.selectAll() },
      { type: "separator" },
      { i18n: "menu.edit.find", shortcut: "Ctrl+F", action: () => actions.find() }
    ],
    view: [
      { i18n: "menu.view.read", shortcut: "Ctrl+E", action: () => actions.setMode("read"), checkable: true, isChecked: () => actions.getMode?.() === "read" },
      { i18n: "menu.view.edit", shortcut: "Ctrl+E", action: () => actions.setMode("edit"), checkable: true, isChecked: () => actions.getMode?.() === "edit" },
      { type: "separator" },
      { i18n: "menu.view.toc", shortcut: "Ctrl+\\", action: () => actions.toggleTOC() },
      { type: "separator" },
      { i18n: "menu.view.theme_light", action: () => actions.setTheme("light"), checkable: true, isChecked: () => actions.getTheme?.() === "light" },
      { i18n: "menu.view.theme_dark", action: () => actions.setTheme("dark"), checkable: true, isChecked: () => actions.getTheme?.() === "dark" },
      { i18n: "menu.view.theme_auto", action: () => actions.setTheme("auto"), checkable: true, isChecked: () => actions.getTheme?.() === "auto" },
      { type: "separator" },
      { i18n: "menu.view.zoom_in", shortcut: "Ctrl++", action: () => actions.zoomIn() },
      { i18n: "menu.view.zoom_out", shortcut: "Ctrl+-", action: () => actions.zoomOut() },
      { i18n: "menu.view.zoom_reset", shortcut: "Ctrl+0", action: () => actions.zoomReset() },
      { type: "separator" },
      { i18n: "menu.view.fullscreen", shortcut: "F11", action: () => actions.fullscreen() }
    ],
    help: [
      { i18n: "menu.help.usage", shortcut: "F1", action: () => actions.showHelp() },
      { type: "separator" },
      { i18n: "menu.help.mermaid", action: () => actions.toggleMermaid(), checkable: true, isChecked: () => actions.isMermaidEnabled?.() },
      { i18n: "menu.help.katex", action: () => actions.toggleKatex(), checkable: true, isChecked: () => actions.isKatexEnabled?.() },
      { type: "separator" },
      { i18n: "menu.help.language", action: () => actions.showLangPicker() },
      { type: "separator" },
      { i18n: "menu.help.about", action: () => actions.showAbout() }
    ]
  };
}

export function setupMenus(i18n, actions) {
  const buttons = document.querySelectorAll(".menubar .menu-item[data-menu]");

  function closeAll() {
    document.querySelectorAll(".menu-dropdown").forEach(d => d.remove());
    buttons.forEach(b => b.classList.remove("open"));
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menus = buildMenuConfig(actions); // rebuild each open to refresh checked state
      const menuKey = btn.dataset.menu;
      const wasOpen = btn.classList.contains("open");
      closeAll();
      if (wasOpen) return;

      btn.classList.add("open");
      const items = menus[menuKey];
      const dropdown = document.createElement("div");
      dropdown.className = "menu-dropdown";

      items.forEach(item => {
        if (item.type === "separator") {
          const sep = document.createElement("div");
          sep.className = "menu-separator";
          dropdown.appendChild(sep);
          return;
        }
        const row = document.createElement("button");
        row.className = "menu-row";
        const label = document.createElement("span");
        label.className = "menu-row-label";
        let labelText = i18n.t(item.i18n);
        if (item.checkable && item.isChecked?.()) {
          labelText = "✓  " + labelText;
        } else if (item.checkable) {
          labelText = "    " + labelText;
        }
        label.textContent = labelText;
        row.appendChild(label);

        if (item.shortcut) {
          const sc = document.createElement("span");
          sc.className = "menu-row-shortcut";
          sc.textContent = item.shortcut;
          row.appendChild(sc);
        }
        row.addEventListener("click", () => {
          closeAll();
          item.action?.();
        });
        dropdown.appendChild(row);
      });

      document.body.appendChild(dropdown);
      const rect = btn.getBoundingClientRect();
      dropdown.style.position = "absolute";
      dropdown.style.top = `${rect.bottom + 2}px`;
      dropdown.style.left = `${rect.left}px`;
    });
  });

  document.addEventListener("click", closeAll);

  // Keyboard ESC closes menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}
