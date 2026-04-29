// statusbar.js — bottom status bar with i18n-aware updates

export class StatusBar {
  constructor(i18n) {
    this.i18n = i18n;
    this.elements = {
      path: document.getElementById("status-path"),
      encoding: document.getElementById("status-encoding"),
      stats: document.getElementById("status-stats"),
      mode: document.getElementById("status-mode")
    };
    this.state = {
      path: null,
      encoding: "UTF-8",
      text: "",
      mode: "read",
      dirty: false
    };
  }

  refresh() {
    this.setPath(this.state.path);
    this.setEncoding(this.state.encoding);
    this.setStats(this.state.text);
    this.setMode(this.state.mode);
  }

  setPath(path) {
    this.state.path = path;
    if (path) {
      const name = path.split(/[\\/]/).pop();
      this.elements.path.textContent = `📄 ${name}`;
      this.elements.path.title = path;
      this.elements.path.removeAttribute("data-i18n");
    } else {
      this.elements.path.dataset.i18n = "status.no_file";
      this.elements.path.textContent = this.i18n.t("status.no_file");
      this.elements.path.title = "";
    }
  }

  setEncoding(encoding) {
    this.state.encoding = encoding || "UTF-8";
    this.elements.encoding.textContent = this.state.encoding;
  }

  setStats(text) {
    this.state.text = text || "";
    const chars = this.state.text.length;
    this.elements.stats.textContent = this.i18n.t("status.chars", { n: chars.toLocaleString() });
  }

  setMode(mode) {
    this.state.mode = mode;
    const key = mode === "edit" ? "status.edit_mode" : "status.read_mode";
    this.elements.mode.dataset.i18n = key;
    let text = this.i18n.t(key);
    if (this.state.dirty) text += "  " + this.i18n.t("status.dirty");
    this.elements.mode.textContent = text;
  }

  setDirty(isDirty) {
    this.state.dirty = !!isDirty;
    this.setMode(this.state.mode);
  }
}
