// shortcuts.js — global keyboard shortcuts

const KEY_MAP = [
  { keys: "Ctrl+O", action: "open" },
  { keys: "Ctrl+S", action: "save" },
  { keys: "Ctrl+Shift+S", action: "saveAs" },
  { keys: "Ctrl+P", action: "print" },
  { keys: "Ctrl+W", action: "close" },
  { keys: "Ctrl+E", action: "toggleMode" },
  { keys: "Ctrl+\\", action: "toggleTOC" },
  { keys: "Ctrl+F", action: "find" },
  { keys: "Ctrl+=", action: "zoomIn" },
  { keys: "Ctrl++", action: "zoomIn" },
  { keys: "Ctrl+-", action: "zoomOut" },
  { keys: "Ctrl+_", action: "zoomOut" },
  { keys: "Ctrl+0", action: "zoomReset" },
  { keys: "F1", action: "showHelp" },
  { keys: "F11", action: "fullscreen" },
  { keys: "Escape", action: "escape" }
];

function eventToKey(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let k = e.key;
  if (k === " ") k = "Space";
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join("+");
}

export function setupShortcuts(actions) {
  document.addEventListener("keydown", (e) => {
    // Don't intercept if focused on textarea/input (let native shortcuts work)
    // EXCEPT for our specific app shortcuts
    const key = eventToKey(e);
    const match = KEY_MAP.find(m => m.keys === key);
    if (match && actions[match.action]) {
      // Allow default for editor-specific keys when in edit mode
      const inEditor = document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";
      const editorKeys = ["Ctrl+A", "Ctrl+Z", "Ctrl+Y", "Ctrl+X", "Ctrl+C", "Ctrl+V"];
      if (inEditor && editorKeys.includes(key)) {
        // let browser handle native, our shortcut is a no-op route
        return;
      }
      e.preventDefault();
      actions[match.action]();
    }
  });
}
