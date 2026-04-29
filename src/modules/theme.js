// theme.js — light / dark / auto theme switching

const KEY = "md-reader.theme";

export class Theme {
  constructor() {
    this.mode = localStorage.getItem(KEY) || "auto";
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", () => {
      if (this.mode === "auto") this.apply();
    });
    this.apply();
  }

  set(mode) {
    if (!["light", "dark", "auto"].includes(mode)) return;
    this.mode = mode;
    localStorage.setItem(KEY, mode);
    this.apply();
  }

  cycle() {
    // light → dark → auto → light
    const next = this.mode === "light" ? "dark" : this.mode === "dark" ? "auto" : "light";
    this.set(next);
  }

  effective() {
    return this.mode === "auto"
      ? (this.mediaQuery.matches ? "dark" : "light")
      : this.mode;
  }

  apply() {
    const eff = this.effective();
    document.documentElement.dataset.theme = eff;

    // Toggle highlight.js stylesheets
    const lightLink = document.getElementById("hljs-light");
    const darkLink = document.getElementById("hljs-dark");
    if (lightLink) lightLink.disabled = eff === "dark";
    if (darkLink) darkLink.disabled = eff === "light";
  }
}
