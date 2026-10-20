import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askRestoreSession } from "../src/modules/restoreDialog.js";

const i18n = { t: (key, params = {}) => `${key}${params.count === undefined ? "" : ` ${params.count}`}` };
const session = { tabs: [{ filePath: "C:\\notes\\one.md" }, { filePath: "C:/other/two.md" }] };

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: vi.fn(function () { this.open = true; }) });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn(function () { this.open = false; }) });
});
afterEach(() => {
  document.body.replaceChildren();
  delete HTMLDialogElement.prototype.showModal;
  delete HTMLDialogElement.prototype.close;
  vi.restoreAllMocks();
});

describe("restore session choice", () => {
  it("shows every file, accessible descriptions and focuses the restore action", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const promise = askRestoreSession(i18n, session);
    const dialog = document.querySelector("dialog");
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-labelledby")).toBe(dialog.querySelector("h2").id);
    expect(dialog.getAttribute("aria-describedby")).toBe(dialog.querySelector(".restore-description").id);
    expect(dialog.querySelector(".restore-description").textContent).toBe("session.description 2");
    expect([...dialog.querySelectorAll(".restore-file-name")].map(el => el.textContent)).toEqual(["one.md", "two.md"]);
    expect(dialog.querySelector(".restore-file-path").textContent).toBe("C:\\notes\\");
    expect(document.activeElement).toBe(dialog.querySelector(".restore-primary"));
    dialog.querySelector(".restore-primary").click();
    expect(await promise).toBe(true);
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("returns false for a fresh session", async () => {
    const promise = askRestoreSession(i18n, session);
    document.querySelector(".restore-fresh").click();
    expect(await promise).toBe(false);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("treats native Escape cancellation as fresh, while backdrop clicks leave it open", async () => {
    const promise = askRestoreSession(i18n, session);
    const dialog = document.querySelector("dialog");
    dialog.click();
    expect(dialog.isConnected).toBe(true);
    const cancel = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(await promise).toBe(false);
    expect(dialog.isConnected).toBe(false);
  });

  it("renders unsafe path text literally and does not truncate a long list", async () => {
    const tabs = Array.from({ length: 60 }, (_, index) => ({ filePath: `C:/<img src=x onerror=alert(1)>/file${index}.md` }));
    const promise = askRestoreSession(i18n, { tabs });
    expect(document.querySelectorAll(".restore-file")).toHaveLength(60);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector(".restore-file-path").textContent).toContain("<img");
    document.querySelector(".restore-fresh").click();
    await promise;
  });

  it("cleans event listeners and can be opened again independently", async () => {
    const first = askRestoreSession(i18n, session);
    const oldDialog = document.querySelector("dialog");
    const oldRestore = oldDialog.querySelector(".restore-primary");
    oldDialog.dispatchEvent(new Event("close"));
    expect(await first).toBe(false);
    const second = askRestoreSession(i18n, session);
    oldRestore.click();
    oldDialog.dispatchEvent(new Event("cancel"));
    expect(document.querySelector("dialog")).not.toBeNull();
    document.querySelector(".restore-primary").click();
    expect(await second).toBe(true);
  });
});
