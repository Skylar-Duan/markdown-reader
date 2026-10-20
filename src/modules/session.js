// Only file locations and view state belong here; document text stays on disk.
export const SESSION_KEY = "md-reader.session";

export function normalizePath(path) {
  return typeof path === "string" ? path.replace(/\\/g, "/").toLowerCase() : "";
}

function position(value, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return integer ? Math.floor(value) : value;
}

function sanitizeTabs(input, activeIndex) {
  const tabs = [];
  const indices = new Map();
  let selected = 0;
  input.forEach((tab, index) => {
    if (!tab || typeof tab.filePath !== "string" || !tab.filePath.trim() || /[\u0000-\u001f]/.test(tab.filePath)) return;
    const key = normalizePath(tab.filePath);
    if (!indices.has(key)) {
      indices.set(key, tabs.length);
      const start = position(tab.editorSelStart, true);
      tabs.push({
        filePath: tab.filePath,
        mode: tab.mode === "edit" ? "edit" : "read",
        contentScrollTop: position(tab.contentScrollTop),
        editorScrollTop: position(tab.editorScrollTop),
        editorSelStart: start,
        editorSelEnd: Math.max(start, position(tab.editorSelEnd, true))
      });
    }
    if (index === activeIndex) selected = indices.get(key);
  });
  return tabs.length ? { version: 1, tabs, activeIndex: selected } : null;
}

export function readSession(storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(SESSION_KEY));
    if (!value || value.version !== 1 || !Array.isArray(value.tabs)) return null;
    return sanitizeTabs(value.tabs, value.activeIndex);
  } catch {
    return null;
  }
}

export function writeSession(tabs, activeId, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const list = Array.isArray(tabs) ? tabs : [];
    const session = sanitizeTabs(list, list.findIndex(tab => tab?.id === activeId));
    if (session) target.setItem(SESSION_KEY, JSON.stringify(session));
    else target.removeItem(SESSION_KEY);
    return true;
  } catch {
    // A denied or full store must never interrupt opening, editing, or closing.
    return false;
  }
}
