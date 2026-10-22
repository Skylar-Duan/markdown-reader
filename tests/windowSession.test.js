import { createWindowSession } from "../src/modules/windowSession.js";
import { readSession } from "../src/modules/session.js";

describe("multi-window session metadata", () => {
  beforeEach(() => localStorage.clear());
  const tab = (id, path) => ({ id, filePath: path, rawText: "private draft", mode: "read" });
  it("combines both windows without storing document text", () => {
    const main = createWindowSession("main", true);
    const other = createWindowSession("document-2", false);
    main.save([tab(1, "S:/one.md")], 1);
    other.save([tab(1, "S:/two.md")], 1);
    expect(readSession().tabs.map(t => t.filePath).sort()).toEqual(["S:/one.md", "S:/two.md"]);
    expect(localStorage.getItem("md-reader.session")).not.toContain("private draft");
  });
  it("a new empty window never erases the existing window", () => {
    const main = createWindowSession("main", true);
    main.save([tab(1, "S:/one.md")], 1);
    createWindowSession("document-2", false).save([], null);
    expect(readSession().tabs[0].filePath).toBe("S:/one.md");
  });
  it("a transferred tab survives removal of its source window", () => {
    const source = createWindowSession("main", true);
    const target = createWindowSession("document-2", false);
    source.save([tab(1, "S:/one.md")], 1);
    target.save([tab(9, "S:/one.md")], 9);
    target.remove("main");
    expect(readSession().tabs.map(t => t.filePath)).toEqual(["S:/one.md"]);
  });
  it("cold startup clears stale window entries after the caller reads the old snapshot", () => {
    createWindowSession("old", false).save([tab(1, "S:/old.md")], 1);
    const old = readSession();
    const fresh = createWindowSession("main", true);
    fresh.save([tab(1, "S:/new.md")], 1);
    expect(old.tabs[0].filePath).toBe("S:/old.md");
    expect(readSession().tabs.map(t => t.filePath)).toEqual(["S:/new.md"]);
  });
});
