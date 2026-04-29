// zoom.js — font size control

const KEY = "md-reader.zoom";
const MIN = 11;
const MAX = 26;
const DEFAULT = 15.5;
const STEP = 1;

export class Zoom {
  constructor() {
    const stored = parseFloat(localStorage.getItem(KEY));
    this.size = (stored && stored >= MIN && stored <= MAX) ? stored : DEFAULT;
    this.apply();
  }

  delta(d) {
    this.size = Math.max(MIN, Math.min(MAX, this.size + (d * STEP)));
    localStorage.setItem(KEY, this.size);
    this.apply();
  }

  reset() {
    this.size = DEFAULT;
    localStorage.setItem(KEY, this.size);
    this.apply();
  }

  apply() {
    document.documentElement.style.setProperty("--md-font-size", `${this.size}px`);
  }
}
