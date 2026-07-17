// shortcuts.js — global keyboard shortcuts

const KEY_MAP = [
  { keys: "Ctrl+O", action: "open" },
  { keys: "Ctrl+S", action: "save" },
  { keys: "Ctrl+Shift+S", action: "saveAs" },
  { keys: "Ctrl+P", action: "print" },
  { keys: "Ctrl+W", action: "close" },
  { keys: "Ctrl+T", action: "newTab" },
  { keys: "Ctrl+Tab", action: "nextTab" },
  { keys: "Ctrl+Shift+Tab", action: "prevTab" },
  { keys: "Ctrl+PageDown", action: "nextTab" },
  { keys: "Ctrl+PageUp", action: "prevTab" },
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

// App-level commands that must win even when focus is inside the editor.
// Handled in the capture phase so Vditor's own element-level hotkey handlers
// (which may stopPropagation) never see them.
const APP_PRIORITY_KEYS = new Set([
  "Ctrl+O", "Ctrl+S", "Ctrl+Shift+S", "Ctrl+P",
  "Ctrl+W", "Ctrl+T", "Ctrl+Tab", "Ctrl+Shift+Tab", "Ctrl+PageDown", "Ctrl+PageUp",
  "Ctrl+E", "Ctrl+\\", "F1", "F11"
]);

export function setupShortcuts(actions) {
  const run = (e, key) => {
    const match = KEY_MAP.find(m => m.keys === key);
    if (!match || !actions[match.action]) return false;
    e.preventDefault();
    actions[match.action]();
    return true;
  };

  // Capture phase: app-critical shortcuts beat any editor-internal handler
  document.addEventListener("keydown", (e) => {
    const key = eventToKey(e);
    if (!APP_PRIORITY_KEYS.has(key)) return;
    if (run(e, key)) e.stopPropagation();
  }, true);

  // Bubble phase: everything else (zoom, find, escape…)
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;  // already handled above / by the editor
    const key = eventToKey(e);
    if (APP_PRIORITY_KEYS.has(key)) return;
    // Let native editing shortcuts work while typing
    const el = document.activeElement;
    const inEditor = el?.tagName === "TEXTAREA" || el?.tagName === "INPUT" || el?.isContentEditable;
    const editorKeys = ["Ctrl+A", "Ctrl+Z", "Ctrl+Y", "Ctrl+X", "Ctrl+C", "Ctrl+V"];
    if (inEditor && editorKeys.includes(key)) return;
    run(e, key);
  });
}
