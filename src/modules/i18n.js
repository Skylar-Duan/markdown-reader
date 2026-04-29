// i18n.js — internationalization with 5 locales
//
// Locales are imported statically so they're bundled by Vite (no runtime fetch).

import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";
import en from "../locales/en.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";

const SUPPORTED_LOCALES = ["zh-CN", "zh-TW", "en", "ja", "ko"];

const ALL_LOCALES = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en": en,
  "ja": ja,
  "ko": ko
};

export class I18n {
  constructor(locales, defaultLocale = "en") {
    this.locales = locales;
    this.defaultLocale = defaultLocale;
    this.currentLocale = defaultLocale;
    this.listeners = [];
  }

  t(key, params = {}) {
    const dict = this.locales[this.currentLocale] || this.locales[this.defaultLocale] || {};
    const fallback = this.locales[this.defaultLocale] || {};
    const template = dict[key] ?? fallback[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, k) => {
      const v = params[k];
      return v === undefined || v === null ? `{${k}}` : String(v);
    });
  }

  setLocale(locale) {
    this.currentLocale = locale;
    this.listeners.forEach(fn => fn(locale));
  }

  onChange(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  applyToDOM(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    root.querySelectorAll("[data-i18n-title]").forEach(el => {
      el.title = this.t(el.dataset.i18nTitle);
    });
  }
}

// Returns the bundled locales (no fetch needed)
export function loadLocales() {
  return Promise.resolve(ALL_LOCALES);
}

export function detectInitialLocale() {
  const stored = localStorage.getItem("md-reader.locale");
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

  const sys = (navigator.language || "en").toLowerCase();
  if (sys.startsWith("zh-tw") || sys.startsWith("zh-hk") || sys.startsWith("zh-hant")) return "zh-TW";
  if (sys.startsWith("zh")) return "zh-CN";
  if (sys.startsWith("ja")) return "ja";
  if (sys.startsWith("ko")) return "ko";
  return "en";
}

export const LOCALE_NAMES = {
  "zh-CN": { native: "简体中文", short: "中文" },
  "zh-TW": { native: "繁體中文", short: "繁中" },
  "en": { native: "English", short: "EN" },
  "ja": { native: "日本語", short: "日本語" },
  "ko": { native: "한국어", short: "한국어" }
};

export { SUPPORTED_LOCALES, ALL_LOCALES };
