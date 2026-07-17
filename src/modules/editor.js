// editor.js — simple textarea-based editor with dirty tracking

export class Editor {
  constructor(textareaEl, onChange) {
    this.textarea = textareaEl;
    this.onChange = onChange;
    this.dirty = false;
    this.suppressEvent = false;

    this.textarea.addEventListener("input", () => {
      if (this.suppressEvent) return;
      this.dirty = true;
      this.onChange?.(this.textarea.value);
    });
  }

  setText(text) {
    this.suppressEvent = true;
    this.textarea.value = text || "";
    this.dirty = false;
    this.suppressEvent = false;
  }

  getText() {
    return this.textarea.value;
  }

  isDirty() {
    return this.dirty;
  }

  clearDirty() {
    this.dirty = false;
  }

  focus() {
    this.textarea.focus();
  }

  selectAll() {
    this.textarea.select();
  }

  // ── View state (same interface as VditorEditor) ─────────────────────────

  getViewState() {
    return {
      scrollTop: this.textarea.scrollTop,
      selStart: this.textarea.selectionStart,
      selEnd: this.textarea.selectionEnd
    };
  }

  setViewState(state) {
    this.textarea.scrollTop = state?.scrollTop || 0;
    this.textarea.selectionStart = state?.selStart || 0;
    this.textarea.selectionEnd = state?.selEnd || 0;
  }

  restoreView(state) {
    // Selection + scroll before focus — cursor is already in view, so
    // focus() won't scroll away (v1.2.0 behavior).
    this.setViewState(state);
    this.textarea.focus();
  }

  getScrollProgress() {
    const max = Math.max(0, this.textarea.scrollHeight - this.textarea.clientHeight);
    return max > 0 ? this.textarea.scrollTop / max : 0;
  }

  setScrollProgress(progress) {
    // Put the cursor at the line nearest the target position first, so a
    // subsequent focus() doesn't scroll away from where we land (v1.2.0 fix).
    const text = this.textarea.value;
    if (text.length) {
      const target = Math.floor(text.length * progress);
      const lineStart = text.slice(0, target).lastIndexOf("\n") + 1;
      this.textarea.selectionStart = lineStart;
      this.textarea.selectionEnd = lineStart;
    }
    const max = Math.max(0, this.textarea.scrollHeight - this.textarea.clientHeight);
    this.textarea.scrollTop = max * progress;
  }

  execAction(action) {
    document.execCommand(action);
  }

  setTheme() { /* styled via app CSS */ }
  async setLocale() { /* nothing locale-specific */ }
}
