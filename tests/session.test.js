import { describe, expect, it, vi } from "vitest";
import { SESSION_KEY, normalizePath, readSession, writeSession } from "../src/modules/session.js";

function memoryStore(initial = null) {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((key, next) => { value = next; }),
    removeItem: vi.fn(() => { value = null; })
  };
}

describe("saved reading session", () => {
  it.each([null, "{broken", "null", "[]", '{}', '{"version":2,"tabs":[]}', '{"version":1,"tabs":{}}'])
    ("ignores absent or malformed storage: %s", value => {
      expect(readSession(memoryStore(value))).toBeNull();
    });

  it("stores only named file paths and view state, preserving the active tab after filtering", () => {
    const storage = memoryStore();
    writeSession([
      { id: 1, rawText: "PRIVATE DRAFT", dirty: true },
      { id: 2, filePath: "C:\\notes\\one.md", rawText: "PRIVATE CONTENT", dirty: true, encoding: "UTF-8" },
      { id: 3, filePath: "C:\\notes\\two.md", mode: "edit", contentScrollTop: 40, editorScrollTop: 90, editorSelStart: 2, editorSelEnd: 5 }
    ], 3, storage);
    const serialized = storage.setItem.mock.calls[0][1];
    expect(serialized).not.toMatch(/PRIVATE|dirty|encoding|rawText/);
    expect(storage.setItem.mock.calls[0][0]).toBe(SESSION_KEY);
    expect(readSession(storage)).toEqual({ version: 1, activeIndex: 1, tabs: [
      { filePath: "C:\\notes\\one.md", mode: "read", contentScrollTop: 0, editorScrollTop: 0, editorSelStart: 0, editorSelEnd: 0 },
      { filePath: "C:\\notes\\two.md", mode: "edit", contentScrollTop: 40, editorScrollTop: 90, editorSelStart: 2, editorSelEnd: 5 }
    ] });
  });

  it("deduplicates Windows spelling and maps an active duplicate to its first copy", () => {
    const storage = memoryStore(JSON.stringify({ version: 1, activeIndex: 3, tabs: [
      null, { filePath: "C:\\Notes\\A.md" }, { filePath: "C:\\Notes\\B.md" }, { filePath: "c:/notes/a.MD" }
    ] }));
    expect(normalizePath("C:\\Notes\\A.md")).toBe("c:/notes/a.md");
    expect(readSession(storage)).toMatchObject({ activeIndex: 0, tabs: [{ filePath: "C:\\Notes\\A.md" }, { filePath: "C:\\Notes\\B.md" }] });
    writeSession([{ id: 1, filePath: "C:\\A.md" }, { id: 2, filePath: "C:/a.md" }], 2, storage);
    expect(readSession(storage)).toMatchObject({ activeIndex: 0, tabs: [{ filePath: "C:\\A.md" }] });
  });

  it("drops invalid paths and sanitizes damaged view positions", () => {
    const storage = memoryStore(JSON.stringify({ version: 1, activeIndex: 6, tabs: [
      {}, { filePath: 12 }, { filePath: " " }, { filePath: "a\u0000.md" },
      { filePath: "good.md", mode: "alien", contentScrollTop: -5, editorScrollTop: "20", editorSelStart: 9.8, editorSelEnd: 3 }
    ] }));
    expect(readSession(storage)).toEqual({ version: 1, activeIndex: 0, tabs: [{
      filePath: "good.md", mode: "read", contentScrollTop: 0, editorScrollTop: 0, editorSelStart: 9, editorSelEnd: 9
    }] });
  });

  it("removes a closed session so next launch does not prompt", () => {
    const storage = memoryStore();
    writeSession([{ id: 1, filePath: "a.md" }], 1, storage);
    writeSession([{ id: 2, filePath: null }], 2, storage);
    expect(storage.removeItem).toHaveBeenCalledWith(SESSION_KEY);
    expect(readSession(storage)).toBeNull();
  });

  it("survives blocked storage reads, writes and removal", () => {
    const denied = () => { throw new Error("denied"); };
    const storage = { getItem: denied, setItem: denied, removeItem: denied };
    expect(readSession(storage)).toBeNull();
    expect(writeSession([{ filePath: "a.md" }], null, storage)).toBe(false);
    expect(writeSession([], null, storage)).toBe(false);
  });
});
