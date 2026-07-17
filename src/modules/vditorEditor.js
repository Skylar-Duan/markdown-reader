// vditorEditor.js — WYSIWYG-style markdown editor backed by Vditor (IR mode).
//
// Presents the same interface as the classic textarea Editor so app.js can use
// either. Vditor construction is async; calls made before it is ready operate
// on a pending value that is applied in the `after` callback.
//
// Locale changes require a full destroy + recreate (Vditor has no setLang).

import Vditor from "vditor";
import "vditor/dist/index.css";

// Served from vite publicDir; staged by scripts/copy-vditor-assets.mjs.
// Relative (no leading slash) so it resolves under both the vite dev server
// and Tauri's production origin with base "./".
const CDN = "vditor-assets";

const VDITOR_LANG = {
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
  "en": "en_US",
  "ja": "ja_JP",
  "ko": "ko_KR"
};

const TOOLBAR = [
  "headings", "bold", "italic", "strike", "inline-code", "link",
  "|", "list", "ordered-list", "check",
  "|", "quote", "code", "table",
  "|", "undo", "redo",
  "|", "edit-mode"
];

export class VditorEditor {
  /**
   * @param {HTMLElement} rootEl   container the Vditor instance mounts into
   * @param {(text: string) => void} onChange fired on user edits
   */
  constructor(rootEl, onChange) {
    this.root = rootEl;
    this.onChange = onChange;
    this.vditor = null;
    this.ready = false;
    this.dirty = false;
    this.suppressEvent = false;
    this._pendingText = "";
    this._locale = "en";
    this._effTheme = "light";
  }

  /** Resolves once the first instance is usable; rejects if Vditor can't boot. */
  init(locale, effTheme) {
    this._locale = locale;
    this._effTheme = effTheme;
    return this._create();
  }

  _create() {
    return new Promise((resolve, reject) => {
      const dark = this._effTheme === "dark";
      let settled = false;
      // Vditor swallows some internal failures; treat a silent init as fatal
      // so the caller can fall back to the classic editor.
      const guard = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error("vditor init timeout")); }
      }, 8000);

      try {
        this.vditor = new Vditor(this.root, {
          cdn: CDN,
          mode: "ir",
          value: this._pendingText,
          lang: VDITOR_LANG[this._locale] || "en_US",
          theme: dark ? "dark" : "classic",
          icon: "material",
          height: "100%",
          cache: { enable: false },
          counter: { enable: false },
          outline: { enable: false },
          toolbar: TOOLBAR,
          toolbarConfig: { pin: true },
          preview: {
            theme: {
              current: dark ? "dark" : "light",
              path: `${CDN}/dist/css/content-theme`
            },
            hljs: { style: dark ? "native" : "github", lineNumber: false },
            math: { engine: "KaTeX" }
          },
          input: (value) => {
            if (this.suppressEvent) return;
            this.dirty = true;
            this.onChange?.(value);
          },
          after: () => {
            clearTimeout(guard);
            this.ready = true;
            if (!settled) { settled = true; resolve(); }
          }
        });
      } catch (e) {
        clearTimeout(guard);
        if (!settled) { settled = true; reject(e); }
      }
    });
  }

  // ── Editor interface (mirrors editor.js) ────────────────────────────────

  setText(text) {
    this._pendingText = text || "";
    this.dirty = false;
    if (!this.ready) return;
    this.suppressEvent = true;
    this.vditor.setValue(this._pendingText);
    this.suppressEvent = false;
  }

  getText() {
    if (!this.ready) return this._pendingText;
    return this.vditor.getValue();
  }

  isDirty() { return this.dirty; }
  clearDirty() { this.dirty = false; }

  focus() {
    if (this.ready) this.vditor.focus();
  }

  selectAll() {
    const el = this._editArea();
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ── Scroll / view state ─────────────────────────────────────────────────

  /** The scrollable, editable element of the current Vditor mode. */
  _editArea() {
    const v = this.vditor?.vditor;
    if (!v) return null;
    const pane = v[v.currentMode];      // ir / sv / wysiwyg
    return pane?.element || null;
  }

  getViewState() {
    const el = this._editArea();
    return { scrollTop: el ? el.scrollTop : 0, selStart: 0, selEnd: 0 };
  }

  setViewState(state) {
    const el = this._editArea();
    if (el) el.scrollTop = state?.scrollTop || 0;
  }

  restoreView(state) {
    // Focus first — Vditor may scroll to its caret on focus — then override
    // with the saved scroll position.
    this.focus();
    this.setViewState(state);
  }

  getScrollProgress() {
    const el = this._editArea();
    if (!el) return 0;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    return max > 0 ? el.scrollTop / max : 0;
  }

  setScrollProgress(progress) {
    const el = this._editArea();
    if (!el) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = max * progress;
  }

  // ── Edit-menu actions ────────────────────────────────────────────────────
  // Vditor keeps its own undo stack keyed off keydown events, so menu-driven
  // undo/redo is delivered as a synthetic Ctrl+Z / Ctrl+Y to the edit area.

  execAction(action) {
    const KEYS = {
      undo: { key: "z", ctrlKey: true },
      redo: { key: "y", ctrlKey: true }
    };
    if (action === "cut" || action === "copy" || action === "paste") {
      document.execCommand(action);
      return;
    }
    const spec = KEYS[action];
    const el = this._editArea();
    if (!spec || !el) return;
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", {
      key: spec.key,
      ctrlKey: !!spec.ctrlKey,
      bubbles: true,
      cancelable: true
    }));
  }

  // ── Theme / locale ───────────────────────────────────────────────────────

  setTheme(effTheme) {
    this._effTheme = effTheme;
    if (!this.ready) return;
    const dark = effTheme === "dark";
    this.vditor.setTheme(
      dark ? "dark" : "classic",
      dark ? "dark" : "light",
      dark ? "native" : "github"
    );
  }

  /** Recreates the instance (Vditor's language is fixed at construction). */
  async setLocale(locale) {
    if (locale === this._locale) return;
    this._locale = locale;
    if (!this.ready) return;
    this._pendingText = this.vditor.getValue();
    const wasDirty = this.dirty;
    this.ready = false;
    try { this.vditor.destroy(); } catch { /* already gone */ }
    await this._create();
    this.dirty = wasDirty;
  }
}
