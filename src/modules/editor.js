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
}
