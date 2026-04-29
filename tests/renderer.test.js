import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/modules/renderer.js";

describe("renderMarkdown", () => {
  it("renders heading with id", () => {
    const html = renderMarkdown("# Hello World");
    expect(html).toMatch(/<h1 id="[^"]+">/);
    expect(html).toContain("Hello World");
  });

  it("renders multiple heading levels", () => {
    const html = renderMarkdown("# H1\n\n## H2\n\n### H3");
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
  });

  it("renders bold and italic", () => {
    const html = renderMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders unordered list", () => {
    const html = renderMarkdown("- a\n- b\n- c");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("<li>c</li>");
  });

  it("renders ordered list", () => {
    const html = renderMarkdown("1. one\n2. two");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders blockquote", () => {
    const html = renderMarkdown("> quoted text");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted text");
  });

  it("renders code block with language class", () => {
    const html = renderMarkdown("```python\nprint('hi')\n```");
    expect(html).toContain("hljs");
    expect(html).toContain("language-python");
  });

  it("preserves unknown language as language-X for plugin handling", () => {
    const html = renderMarkdown("```mermaid\ngraph TD\n```");
    expect(html).toContain("language-mermaid");
  });

  it("renders GFM table with header", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("strips inline scripts (XSS)", () => {
    const html = renderMarkdown("<script>alert(1)</script>Hello");
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("Hello");
  });

  it("strips on* event attributes (XSS)", () => {
    const html = renderMarkdown('<a href="x" onclick="alert(1)">link</a>');
    expect(html).not.toMatch(/onclick=/i);
  });

  it("blocks javascript: URLs", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("renders link with http scheme + external marker", () => {
    const html = renderMarkdown("[example](https://example.com)");
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com"/);
    expect(html).toMatch(/data-external/);
  });

  it("renders inline code differently from code blocks", () => {
    const html = renderMarkdown("normal `inline` text");
    expect(html).toContain("<code>inline</code>");
    expect(html).not.toMatch(/<pre[^>]*>[\s\S]*<code[^>]*>inline/);
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown(null)).toBe("");
  });
});
