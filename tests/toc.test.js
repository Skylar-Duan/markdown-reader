import { describe, it, expect } from "vitest";
import { extractTOC } from "../src/modules/toc.js";

describe("extractTOC", () => {
  it("extracts headings with id, depth, text", () => {
    const html = `<h1 id="a">A</h1><h2 id="b">B</h2><h3 id="c">C</h3>`;
    const toc = extractTOC(html);
    expect(toc).toEqual([
      { id: "a", depth: 1, text: "A" },
      { id: "b", depth: 2, text: "B" },
      { id: "c", depth: 3, text: "C" }
    ]);
  });

  it("returns empty for HTML with no headings", () => {
    expect(extractTOC("<p>just text</p>")).toEqual([]);
  });

  it("strips inner formatting tags from heading text", () => {
    const html = `<h2 id="x"><strong>Bold</strong> Title</h2>`;
    expect(extractTOC(html)[0].text).toBe("Bold Title");
  });

  it("extracts headings of all 6 levels", () => {
    let html = "";
    for (let i = 1; i <= 6; i++) html += `<h${i} id="h${i}">Level ${i}</h${i}>`;
    const toc = extractTOC(html);
    expect(toc).toHaveLength(6);
    expect(toc.map(t => t.depth)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("handles empty HTML", () => {
    expect(extractTOC("")).toEqual([]);
  });
});
