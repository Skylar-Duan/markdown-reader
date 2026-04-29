// app.js — main application entry, wires all modules together

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
import { shouldShowFirstRun, showFirstRunDialog } from "./modules/firstRunDialog.js";

// External link routing through Tauri shell (lazy loaded)
let openExternalUrl = (url) => {
  // Default: try Tauri shell, fall back to window.open
  import("@tauri-apps/plugin-shell")
    .then(shell => shell.open(url))
    .catch(() => window.open(url, "_blank"));
};

// ── App state ─────────────────────────────────────────────────────────────
const state = {
  filePath: null,
  rawText: "",
  mode: "read",      // "read" | "edit"
  encoding: "UTF-8",
  isWelcome: true
};

// ── Boot ──────────────────────────────────────────────────────────────────
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

document.addEventListener("DOMContentLoaded", boot);
async function boot() {
  // Load locales and apply
  const locales = await loadLocales();
  i18n.locales = locales;
  i18n.setLocale(detectInitialLocale());

  // Theme
  theme = new Theme();

  // Editor
  editor = new Editor(document.getElementById("editor-input"), (newText) => {
    state.rawText = newText;
    statusBar?.setStats(newText);
    statusBar?.setDirty(true);
  });

  // StatusBar / Zoom / Search / Dialogs
  statusBar = new StatusBar(i18n);
  zoom = new Zoom();
  search = new Search(i18n);
  aboutDialog = new AboutDialog(i18n);
  helpDialog = new HelpDialog(i18n);

  // FileOps
  fileOps = new FileOps({
    i18n,
    onLoaded: ({ path, content, encoding }) => {
      state.filePath = path;
      state.rawText = content;
      state.encoding = encoding || "UTF-8";
      state.isWelcome = false;
      editor.setText(content);
      statusBar.setPath(path);
      statusBar.setEncoding(state.encoding);
      statusBar.setStats(content);
      statusBar.setDirty(false);
      const name = path.split(/[\\/]/).pop();
      document.getElementById("window-title").textContent = `${name} — Markdown Reader`;
      rerender();
    },
    onSaved: (newPath) => {
      if (newPath) {
        state.filePath = newPath;
        statusBar.setPath(newPath);
        const name = newPath.split(/[\\/]/).pop();
        document.getElementById("window-title").textContent = `${name} — Markdown Reader`;
      }
      editor.clearDirty();
      statusBar.setDirty(false);
    },
    getDirty: () => editor.isDirty(),
    getCurrent: () => state
  });

  // i18n DOM apply on load + on change
  i18n.applyToDOM();
  i18n.onChange(() => {
    i18n.applyToDOM();
    statusBar.refresh();
    refreshLangLabel();
  });

  // ── Plugin init ────────────────────────────────────────────────────────
  if (mermaidPlugin.isEnabled()) await mermaidPlugin.setEnabled(true);
  if (katexPlugin.isEnabled()) await katexPlugin.setEnabled(true);

  // ── Wire UI ────────────────────────────────────────────────────────────
  setupModeToggle();
  setupThemeToggle();
  setupLangPicker();
  setupContentClickHandler();
  setupBeforeUnload();

  // ── Actions object ────────────────────────────────────────────────────
  const actions = {
    open: () => fileOps.open(),
    save: () => fileOps.save(),
    saveAs: () => fileOps.saveAs(),
    print: () => window.print(),
    setDefault: () => fileOps.setAsDefaultMd(),
    close: async () => {
      if (await fileOps.confirmDiscard()) {
        try {
          const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
          getCurrentWebviewWindow().close();
        } catch {
          window.close();
        }
      }
    },
    undo: () => { if (state.mode === "edit") document.execCommand("undo"); },
    redo: () => { if (state.mode === "edit") document.execCommand("redo"); },
    cut: () => { if (state.mode === "edit") document.execCommand("cut"); },
    copy: () => {
      if (state.mode === "edit") {
        document.execCommand("copy");
      } else {
        const sel = window.getSelection().toString();
        if (sel) navigator.clipboard.writeText(sel);
      }
    },
    paste: () => { if (state.mode === "edit") document.execCommand("paste"); },
    selectAll: () => {
      if (state.mode === "edit") {
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
    toggleMode: () => switchMode(state.mode === "read" ? "edit" : "read"),
    getMode: () => state.mode,
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
      // Close any open menus/dropdowns; let other escape handlers take over
      document.querySelectorAll(".menu-dropdown, .lang-dropdown").forEach(d => d.remove());
    }
  };

  setupShortcuts(actions);
  setupMenus(i18n, actions);

  // Initial render
  applyMode(state.mode, i18n);
  await renderInitial();

  // Hookup file ops
  fileOps.setupDragDrop();

  // Multi-window support: secondary windows get the file via URL hash
  // (set by the single-instance plugin in Rust). First window falls back
  // to CLI args.
  const hashFile = readFileFromHash();
  if (hashFile) {
    setTimeout(() => fileOps.open(hashFile), 50);
  } else {
    await fileOps.setupCliArgs();
  }

  // Setup scroll spy for TOC
  setupScrollSpy(document.getElementById("content"), document.getElementById("toc"));

  // First-run prompt: ask to set as default .md handler
  // Only show if no file was opened via CLI (so it doesn't pop over actual content)
  if (shouldShowFirstRun() && !state.filePath) {
    setTimeout(() => {
      showFirstRunDialog(
        i18n,
        () => fileOps.setAsDefaultMd(),
        () => {}
      );
    }, 500);
  }
}

async function renderInitial() {
  if (!state.filePath) {
    state.isWelcome = true;
    renderWelcome(i18n, fileOps.getRecent(), (p) => fileOps.open(p));
    statusBar.refresh();
    document.getElementById("toc").innerHTML = "";
  } else {
    await rerender();
  }
}

async function rerender() {
  if (state.isWelcome && !state.filePath) return;

  const html = renderMarkdown(state.rawText);
  const output = document.getElementById("renderer-output");
  output.innerHTML = html;

  // Apply optional plugins
  if (mermaidPlugin.isEnabled()) {
    mermaidPlugin.applyTheme(theme.effective());
    await mermaidPlugin.processBlocks(output);
  }
  if (katexPlugin.isEnabled()) {
    katexPlugin.processBlocks(output);
  }

  // TOC
  const tocItems = extractTOC(html);
  renderTOC(tocItems, document.getElementById("toc"), {
    emptyText: i18n.t("toc.empty")
  });

  statusBar.setStats(state.rawText);
}

// Capture current scroll position as a 0..1 fraction, so it survives
// mode switches even when read & edit views have different total heights.
function getScrollProgress() {
  const el = state.mode === "edit"
    ? document.getElementById("editor-input")
    : document.getElementById("content");
  if (!el) return 0;
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  return max > 0 ? el.scrollTop / max : 0;
}

function applyScrollProgress(progress) {
  // Wait two animation frames so layout (and any plugin post-processing
  // that can change heights) has settled before we restore the position.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = state.mode === "edit"
      ? document.getElementById("editor-input")
      : document.getElementById("content");
    if (!el) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = max * progress;
  }));
}

async function switchMode(newMode) {
  if (newMode === state.mode) return;

  // Snapshot scroll progress in the OLD view BEFORE we switch
  const progress = getScrollProgress();

  if (state.mode === "edit" && newMode === "read") {
    // Edit → Read: pull latest text from editor into state, then rerender
    state.rawText = editor.getText();
    state.mode = newMode;
    applyMode(newMode, i18n);
    statusBar.setMode(newMode);
    await rerender();
  } else if (state.mode === "read" && newMode === "edit") {
    // Read → Edit: push state text into editor
    editor.setText(state.rawText);
    state.mode = newMode;
    applyMode(newMode, i18n);
    statusBar.setMode(newMode);
    setTimeout(() => editor.focus(), 50);
  } else {
    state.mode = newMode;
    applyMode(newMode, i18n);
    statusBar.setMode(newMode);
  }

  // Restore the equivalent scroll position in the NEW view
  applyScrollProgress(progress);

  // Toggle pill button
  const btn = document.getElementById("mode-toggle");
  btn.classList.add("pill-active");
}

function setupModeToggle() {
  document.getElementById("mode-toggle").addEventListener("click", () => {
    switchMode(state.mode === "read" ? "edit" : "read");
  });
}

function setupThemeToggle() {
  document.getElementById("theme-toggle").addEventListener("click", () => {
    theme.cycle();
    mermaidPlugin.applyTheme(theme.effective());
    if (state.filePath || !state.isWelcome) rerender();
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
  // Route external links through system browser
  document.getElementById("renderer-output").addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    if (href.startsWith("#")) {
      // anchor — let it scroll naturally OR scroll-into-view
      e.preventDefault();
      const id = href.slice(1);
      const target = document.getElementById(id);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (a.dataset.external === "1" || /^https?:\/\//i.test(href)) {
      e.preventDefault();
      openExternalUrl?.(href);
    }
  });
}

// Parse `#file=<encoded-path>` from URL hash for multi-window support
function readFileFromHash() {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;
  const m = hash.match(/(?:^#|&)file=([^&]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

function setupBeforeUnload() {
  // Tauri 2's window close requires confirmDiscard; window.beforeunload also fires for browser-mode
  window.addEventListener("beforeunload", (e) => {
    if (editor.isDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

// Expose for debugging
window.__app = { state, i18n, theme, editor, statusBar, fileOps, rerender };
