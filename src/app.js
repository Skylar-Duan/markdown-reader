// app.js — main entry, wires modules together with multi-tab state

import { renderMarkdown } from "./modules/renderer.js";
import { extractTOC, renderTOC, setupScrollSpy } from "./modules/toc.js";
import { I18n, loadLocales, detectInitialLocale, LOCALE_NAMES, SUPPORTED_LOCALES } from "./modules/i18n.js";
import { Editor } from "./modules/editor.js";
import { applyMode } from "./modules/modeSwitch.js";
import { Theme } from "./modules/theme.js";
import { StatusBar } from "./modules/statusbar.js";
import { setupShortcuts } from "./modules/shortcuts.js";
import { Search } from "./modules/search.js";
import { setupMenus } from "./modules/menu.js";
import { Zoom } from "./modules/zoom.js";
import { FileOps } from "./modules/fileOps.js";
import { renderWelcome } from "./modules/welcomeScreen.js";
import { AboutDialog } from "./modules/aboutDialog.js";
import { HelpDialog } from "./modules/helpDialog.js";
import * as mermaidPlugin from "./modules/plugins/mermaid.js";
import * as katexPlugin from "./modules/plugins/katex.js";
import { toast } from "./modules/toast.js";

// External link routing through Tauri shell (lazy)
const openExternalUrl = (url) => {
  import("@tauri-apps/plugin-shell")
    .then(shell => shell.open(url))
    .catch(() => window.open(url, "_blank"));
};

// ── Tab data model ────────────────────────────────────────────────────────
let _nextTabId = 1;
function makeTab({ filePath = null, rawText = "", encoding = "UTF-8" } = {}) {
  return {
    id: _nextTabId++,
    filePath,
    rawText,
    encoding,
    mode: "read",          // "read" | "edit"
    dirty: false,
    isWelcome: !filePath && !rawText,
    contentScrollTop: 0,
    editorScrollTop: 0,
    editorSelStart: 0,
    editorSelEnd: 0
  };
}

const tabs = [];           // list of tab objects
let state = null;          // alias for currently active tab (mutated in place)

function activeTab() { return state; }

// ── Module instances ──────────────────────────────────────────────────────
const i18n = new I18n({}, "en");
let theme;
let editor;
let statusBar;
let search;
let zoom;
let fileOps;
let aboutDialog;
let helpDialog;
let langPickerEl;

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  // Locales
  i18n.locales = await loadLocales();
  i18n.setLocale(detectInitialLocale());

  // Theme
  theme = new Theme();

  // Editor
  editor = new Editor(document.getElementById("editor-input"), (newText) => {
    if (!state) return;
    state.rawText = newText;
    state.dirty = true;
    statusBar?.setStats(newText);
    statusBar?.setDirty(true);
    renderTabBar();  // dirty marker on the tab
  });

  // Other modules
  statusBar = new StatusBar(i18n);
  zoom = new Zoom();
  search = new Search(i18n);
  aboutDialog = new AboutDialog(i18n);
  helpDialog = new HelpDialog(i18n);

  // FileOps
  fileOps = new FileOps({
    i18n,
    onLoaded: ({ path, content, encoding }) => {
      // Open in a new tab (or replace empty welcome)
      addFileTab(path, content, encoding);
    },
    onSaved: (newPath) => {
      if (!state) return;
      if (newPath) state.filePath = newPath;
      state.dirty = false;
      editor.clearDirty();
      statusBar.setPath(state.filePath);
      statusBar.setDirty(false);
      renderTabBar();
      updateWindowTitle();
    },
    getDirty: () => state?.dirty || false,
    getCurrent: () => state || { filePath: null, rawText: "" }
  });

  // i18n DOM application
  i18n.applyToDOM();
  i18n.onChange(() => {
    i18n.applyToDOM();
    statusBar.refresh();
    refreshLangLabel();
    renderTabBar();  // tab labels for "Untitled"
  });

  // Plugins
  if (mermaidPlugin.isEnabled()) await mermaidPlugin.setEnabled(true);
  if (katexPlugin.isEnabled()) await katexPlugin.setEnabled(true);

  // UI wiring
  setupModeToggle();
  setupThemeToggle();
  setupLangPicker();
  setupContentClickHandler();
  setupBeforeUnload();
  setupTabBar();

  // Actions for menu / shortcuts
  const actions = {
    open: () => fileOps.open(),
    save: () => fileOps.save(),
    saveAs: () => fileOps.saveAs(),
    print: () => window.print(),
    setDefault: () => fileOps.setAsDefaultMd(),
    close: () => closeActiveTab(),
    newTab: () => newEmptyTab(),
    nextTab: () => switchToNeighborTab(+1),
    prevTab: () => switchToNeighborTab(-1),

    undo: () => { if (state?.mode === "edit") document.execCommand("undo"); },
    redo: () => { if (state?.mode === "edit") document.execCommand("redo"); },
    cut: () => { if (state?.mode === "edit") document.execCommand("cut"); },
    copy: () => {
      if (state?.mode === "edit") {
        document.execCommand("copy");
      } else {
        const sel = window.getSelection().toString();
        if (sel) navigator.clipboard.writeText(sel);
      }
    },
    paste: () => { if (state?.mode === "edit") document.execCommand("paste"); },
    selectAll: () => {
      if (state?.mode === "edit") {
        editor.selectAll();
      } else {
        const r = document.createRange();
        r.selectNodeContents(document.getElementById("renderer-output"));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
    },
    find: () => search.open(),

    setMode: (m) => switchMode(m),
    toggleMode: () => switchMode(state?.mode === "read" ? "edit" : "read"),
    getMode: () => state?.mode || "read",
    toggleTOC: () => {
      const app = document.getElementById("app");
      app.dataset.sidebar = app.dataset.sidebar === "hidden" ? "" : "hidden";
    },

    setTheme: (t) => { theme.set(t); mermaidPlugin.applyTheme(theme.effective()); rerender(); },
    getTheme: () => theme.mode,

    zoomIn: () => zoom.delta(+1),
    zoomOut: () => zoom.delta(-1),
    zoomReset: () => zoom.reset(),

    fullscreen: async () => {
      try {
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const win = getCurrentWebviewWindow();
        const isFs = await win.isFullscreen();
        await win.setFullscreen(!isFs);
      } catch {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.();
      }
    },

    showHelp: () => helpDialog.show(),
    showAbout: () => aboutDialog.show(),
    showLangPicker: () => langPickerEl?.click(),
    toggleMermaid: async () => { await mermaidPlugin.setEnabled(!mermaidPlugin.isEnabled()); rerender(); },
    toggleKatex: async () => { await katexPlugin.setEnabled(!katexPlugin.isEnabled()); rerender(); },
    isMermaidEnabled: () => mermaidPlugin.isEnabled(),
    isKatexEnabled: () => katexPlugin.isEnabled(),

    escape: () => {
      document.querySelectorAll(".menu-dropdown, .lang-dropdown").forEach(d => d.remove());
    }
  };

  setupShortcuts(actions);
  setupMenus(i18n, actions);

  fileOps.setupDragDrop();

  // Tauri event: secondary launches route here to open in new tab
  setupTauriOpenFileEvent();

  // Initial state: 1 welcome tab, then maybe load CLI arg into it
  newEmptyTab();
  await fileOps.setupCliArgs();

  setupScrollSpy(document.getElementById("content"), document.getElementById("toc"));
}

async function setupTauriOpenFileEvent() {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen("open-file-in-tab", async (event) => {
      const path = event.payload;
      if (typeof path === "string" && path.length > 0) {
        await fileOps.open(path);  // → onLoaded → addFileTab
      }
    });
  } catch (e) {
    console.warn("Tauri event listen failed:", e);
  }
}

// ── Tab operations ────────────────────────────────────────────────────────
function newEmptyTab() {
  const t = makeTab();
  tabs.push(t);
  activateTab(t.id);
}

function addFileTab(path, content, encoding) {
  // If active tab is an untouched welcome tab, replace it instead of adding
  const cur = activeTab();
  if (cur && cur.isWelcome && !cur.dirty && !cur.filePath) {
    cur.filePath = path;
    cur.rawText = content;
    cur.encoding = encoding || "UTF-8";
    cur.isWelcome = false;
    cur.dirty = false;
    cur.mode = "read";
    cur.contentScrollTop = 0;
    cur.editorScrollTop = 0;
    cur.editorSelStart = 0;
    cur.editorSelEnd = 0;
    rerenderActiveTab();
    return;
  }
  const t = makeTab({ filePath: path, rawText: content, encoding });
  t.isWelcome = false;
  tabs.push(t);
  activateTab(t.id);
}

async function closeActiveTab() {
  const cur = activeTab();
  if (!cur) {
    closeWindow();
    return;
  }
  // Confirm discard if dirty
  if (cur.dirty) {
    const ok = await fileOps.confirmDiscard();
    if (!ok) return;
  }
  removeTab(cur.id);
}

function removeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  tabs.splice(idx, 1);
  if (tabs.length === 0) {
    closeWindow();
    return;
  }
  // Activate neighbor: prefer the one to the right; else previous
  const newActive = tabs[idx] || tabs[idx - 1];
  activateTab(newActive.id);
}

async function closeWindow() {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    await getCurrentWebviewWindow().close();
  } catch {
    window.close();
  }
}

function switchToNeighborTab(direction) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex(t => t.id === state?.id);
  const next = (idx + direction + tabs.length) % tabs.length;
  activateTab(tabs[next].id);
}

// Save outgoing tab's UI state, switch to the new tab, restore its state.
async function activateTab(id) {
  // Save outgoing tab's view state
  if (state) {
    persistActiveViewState();
  }

  const t = tabs.find(x => x.id === id);
  if (!t) return;
  state = t;

  // Apply mode (which view is visible)
  applyMode(state.mode, i18n);

  // Set editor text & dirty flag (always, so undo history matches per-tab content)
  editor.setText(state.rawText);
  editor.dirty = state.dirty;

  // Render content (or welcome) for this tab
  if (state.isWelcome && !state.filePath) {
    renderWelcome(i18n, fileOps.getRecent(), (p) => fileOps.open(p));
    document.getElementById("toc").innerHTML = "";
  } else {
    await rerender();
  }

  // Restore scroll positions + cursor (after layout settles)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = document.getElementById("content");
    const ta = document.getElementById("editor-input");
    if (state.mode === "read") {
      c.scrollTop = state.contentScrollTop || 0;
    } else {
      ta.scrollTop = state.editorScrollTop || 0;
      ta.selectionStart = state.editorSelStart || 0;
      ta.selectionEnd = state.editorSelEnd || 0;
      ta.focus();
    }
  }));

  // Status bar / window title / tab bar UI
  statusBar.setPath(state.filePath);
  statusBar.setEncoding(state.encoding);
  statusBar.setStats(state.rawText);
  statusBar.setMode(state.mode);
  statusBar.setDirty(state.dirty);
  updateWindowTitle();
  renderTabBar();
}

function persistActiveViewState() {
  if (!state) return;
  if (state.mode === "edit") {
    state.rawText = editor.getText();
    state.dirty = editor.isDirty();
    const ta = document.getElementById("editor-input");
    state.editorScrollTop = ta.scrollTop;
    state.editorSelStart = ta.selectionStart;
    state.editorSelEnd = ta.selectionEnd;
  }
  state.contentScrollTop = document.getElementById("content").scrollTop;
}

// ── Tab bar UI ────────────────────────────────────────────────────────────
function setupTabBar() {
  document.getElementById("tab-new").addEventListener("click", () => newEmptyTab());
}

function renderTabBar() {
  const container = document.getElementById("tab-list");
  container.innerHTML = "";
  for (const t of tabs) {
    const li = document.createElement("li");
    li.className = "tab" + (t.id === state?.id ? " active" : "");
    li.dataset.tabId = t.id;
    li.title = t.filePath || i18n.t("tab.untitled");

    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = t.filePath
      ? t.filePath.split(/[\\/]/).pop()
      : i18n.t("tab.untitled");
    li.appendChild(name);

    if (t.dirty) {
      const dot = document.createElement("span");
      dot.className = "tab-dirty";
      dot.textContent = "●";
      li.appendChild(dot);
    }

    const close = document.createElement("button");
    close.className = "tab-close";
    close.textContent = "✕";
    close.title = i18n.t("tab.close");
    close.addEventListener("click", async (e) => {
      e.stopPropagation();
      // If closing active tab, use the discard-confirming flow
      if (t.id === state?.id) {
        await closeActiveTab();
      } else {
        if (t.dirty) {
          // Switch to that tab first so the confirm dialog shows its name
          activateTab(t.id);
          await closeActiveTab();
        } else {
          removeTab(t.id);
        }
      }
    });
    li.appendChild(close);

    li.addEventListener("click", (e) => {
      if (e.target.closest(".tab-close")) return;
      if (t.id !== state?.id) activateTab(t.id);
    });

    // Middle-click to close
    li.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        if (t.id === state?.id) closeActiveTab();
        else if (t.dirty) { activateTab(t.id); closeActiveTab(); }
        else removeTab(t.id);
      }
    });

    container.appendChild(li);
  }
}

function updateWindowTitle() {
  const name = state?.filePath
    ? state.filePath.split(/[\\/]/).pop()
    : i18n.t("tab.untitled");
  document.title = `${name} — Markdown Reader`;
}

// ── Render / mode switch ──────────────────────────────────────────────────
async function rerender() {
  if (!state) return;
  if (state.isWelcome && !state.filePath) {
    renderWelcome(i18n, fileOps.getRecent(), (p) => fileOps.open(p));
    document.getElementById("toc").innerHTML = "";
    return;
  }

  const html = renderMarkdown(state.rawText);
  const output = document.getElementById("renderer-output");
  output.innerHTML = html;

  if (mermaidPlugin.isEnabled()) {
    mermaidPlugin.applyTheme(theme.effective());
    await mermaidPlugin.processBlocks(output);
  }
  if (katexPlugin.isEnabled()) {
    katexPlugin.processBlocks(output);
  }

  const tocItems = extractTOC(html);
  renderTOC(tocItems, document.getElementById("toc"), {
    emptyText: i18n.t("toc.empty")
  });

  statusBar.setStats(state.rawText);
}

async function rerenderActiveTab() {
  // Rebuild active tab's view from scratch (used when content changes externally)
  applyMode(state.mode, i18n);
  editor.setText(state.rawText);
  editor.dirty = state.dirty;
  await rerender();
  statusBar.setPath(state.filePath);
  statusBar.setEncoding(state.encoding);
  statusBar.setStats(state.rawText);
  statusBar.setMode(state.mode);
  statusBar.setDirty(state.dirty);
  updateWindowTitle();
  renderTabBar();
}

// Capture current scroll progress as a 0..1 fraction
function getScrollProgress() {
  if (!state) return 0;
  const el = state.mode === "edit"
    ? document.getElementById("editor-input")
    : document.getElementById("content");
  if (!el) return 0;
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  return max > 0 ? el.scrollTop / max : 0;
}

// Set cursor to a character index near the given scroll progress.
// This prevents focus() from auto-scrolling away from our restored position.
function syncCursorToProgress(textarea, progress) {
  const text = textarea.value;
  if (!text.length) return;
  const target = Math.floor(text.length * progress);
  // Snap cursor to start of nearest line (cleaner UX)
  const before = text.slice(0, target);
  const lineStart = before.lastIndexOf("\n") + 1;
  textarea.selectionStart = lineStart;
  textarea.selectionEnd = lineStart;
}

async function switchMode(newMode) {
  if (!state || newMode === state.mode) return;
  const progress = getScrollProgress();

  if (state.mode === "edit" && newMode === "read") {
    // Edit → Read: pull text from editor, rerender
    state.rawText = editor.getText();
    state.dirty = editor.isDirty();
    state.mode = newMode;
    applyMode(newMode, i18n);
    statusBar.setMode(newMode);
    statusBar.setDirty(state.dirty);
    await rerender();
    // Restore scroll in #content
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.getElementById("content");
      const max = Math.max(0, c.scrollHeight - c.clientHeight);
      c.scrollTop = max * progress;
    }));
  } else if (state.mode === "read" && newMode === "edit") {
    // Read → Edit:
    //  1. Load text into editor
    //  2. Place cursor near scroll position (so focus doesn't jump)
    //  3. Set scrollTop to exact target
    //  4. Focus
    editor.setText(state.rawText);
    editor.dirty = state.dirty;
    state.mode = newMode;
    applyMode(newMode, i18n);
    statusBar.setMode(newMode);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ta = document.getElementById("editor-input");
      syncCursorToProgress(ta, progress);
      const max = Math.max(0, ta.scrollHeight - ta.clientHeight);
      ta.scrollTop = max * progress;
      ta.focus();
      // Save these so tab switch later restores
      state.editorScrollTop = ta.scrollTop;
      state.editorSelStart = ta.selectionStart;
      state.editorSelEnd = ta.selectionEnd;
    }));
  }
  renderTabBar();
}

// ── Various small UI handlers ─────────────────────────────────────────────
function setupModeToggle() {
  document.getElementById("mode-toggle").addEventListener("click", () => {
    if (!state) return;
    switchMode(state.mode === "read" ? "edit" : "read");
  });
}

function setupThemeToggle() {
  document.getElementById("theme-toggle").addEventListener("click", () => {
    theme.cycle();
    mermaidPlugin.applyTheme(theme.effective());
    if (state && (state.filePath || !state.isWelcome)) rerender();
  });
}

function refreshLangLabel() {
  const label = document.getElementById("lang-label");
  if (label) label.textContent = LOCALE_NAMES[i18n.currentLocale]?.short || i18n.currentLocale;
}

function setupLangPicker() {
  langPickerEl = document.getElementById("lang-picker");
  refreshLangLabel();

  langPickerEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const existing = document.querySelector(".lang-dropdown");
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement("div");
    dropdown.className = "lang-dropdown";
    SUPPORTED_LOCALES.forEach(code => {
      const item = document.createElement("button");
      item.className = "lang-option";
      item.textContent = LOCALE_NAMES[code].native;
      if (code === i18n.currentLocale) item.classList.add("active");
      item.addEventListener("click", () => {
        i18n.setLocale(code);
        localStorage.setItem("md-reader.locale", code);
        dropdown.remove();
      });
      dropdown.appendChild(item);
    });
    document.body.appendChild(dropdown);
    const rect = langPickerEl.getBoundingClientRect();
    dropdown.style.position = "absolute";
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".lang-dropdown").forEach(d => d.remove());
  });
}

function setupContentClickHandler() {
  document.getElementById("renderer-output").addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    if (href.startsWith("#")) {
      e.preventDefault();
      const target = document.getElementById(href.slice(1));
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (a.dataset.external === "1" || /^https?:\/\//i.test(href)) {
      e.preventDefault();
      openExternalUrl(href);
    }
  });
}

function setupBeforeUnload() {
  window.addEventListener("beforeunload", (e) => {
    if (tabs.some(t => t.dirty)) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

// Expose for debugging
window.__app = {
  get state() { return state; },
  get tabs() { return tabs; },
  i18n, theme, editor, statusBar, fileOps, rerender,
  newEmptyTab, addFileTab, activateTab, removeTab
};
