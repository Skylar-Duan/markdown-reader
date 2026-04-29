import { describe, it, expect, beforeEach } from "vitest";
import { I18n } from "../src/modules/i18n.js";

const en = { hi: "Hello", stat: "{n} files", who: "{name} on {day}" };
const zh = { hi: "你好", stat: "{n} 个文件" };

describe("I18n", () => {
  let i18n;
  beforeEach(() => {
    i18n = new I18n({ en, "zh-CN": zh }, "en");
  });

  it("returns string for known key", () => {
    expect(i18n.t("hi")).toBe("Hello");
  });

  it("interpolates {n}", () => {
    expect(i18n.t("stat", { n: 5 })).toBe("5 files");
  });

  it("interpolates multiple params", () => {
    expect(i18n.t("who", { name: "Alice", day: "Monday" })).toBe("Alice on Monday");
  });

  it("falls back to key when missing", () => {
    expect(i18n.t("nonexistent")).toBe("nonexistent");
  });

  it("switches language", () => {
    i18n.setLocale("zh-CN");
    expect(i18n.t("hi")).toBe("你好");
  });

  it("falls back to default locale when target missing", () => {
    i18n.setLocale("xx-XX");
    expect(i18n.t("hi")).toBe("Hello");
  });

  it("falls back to default locale per-key (partial translation)", () => {
    i18n.setLocale("zh-CN");
    // 'who' only in en, not in zh-CN
    expect(i18n.t("who", { name: "X", day: "Y" })).toBe("X on Y");
  });

  it("notifies listeners on locale change", () => {
    let called = null;
    i18n.onChange((loc) => { called = loc; });
    i18n.setLocale("zh-CN");
    expect(called).toBe("zh-CN");
  });

  it("preserves placeholder when param undefined", () => {
    expect(i18n.t("stat")).toBe("{n} files");
  });
});
