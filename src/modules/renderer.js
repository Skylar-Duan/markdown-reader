// renderer.js — Markdown → safe HTML
// Uses marked for parsing, highlight.js for code blocks, DOMPurify for safety.
//
// IMPORTANT: marked v12 invokes overridden Renderer methods with the OLD
// positional API (not the new token-object API), so signatures here are:
//   heading(text, level, raw)
//   code(code, infostring, escaped)
//   link(href, title, text)
// (See: marked v12 internal back-compat for `r.foo = function(...)` overrides)

import { marked } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";

// ── Slugify Heading text → id ─────────────────────────────────────────────
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w一-鿿぀-ヿ가-힯\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "section";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function sanitizeHref(href) {
  const lower = String(href || "").trim().toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:text/html")) {
    return "#";
  }
  return href || "";
}

// ── Custom renderer ───────────────────────────────────────────────────────
const slugSeen = new Map();

function makeRenderer() {
  const r = new marked.Renderer();

  r.heading = function (text, level) {
    // 'text' here is already-rendered inline HTML (from marked v12 back-compat path)
    const plain = String(text || "").replace(/<[^>]+>/g, "");
    const base = slugify(plain);
    const count = (slugSeen.get(base) || 0) + 1;
    slugSeen.set(base, count);
    const id = count > 1 ? `${base}-${count}` : base;
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  };

  r.code = function (code, infostring) {
    const lang = String(infostring || "").trim().split(/\s+/)[0];
    if (lang && hljs.getLanguage(lang)) {
      let highlighted;
      try {
        highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        highlighted = escapeHtml(code);
      }
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>\n`;
    } else {
      // Pass through raw lang (e.g. "mermaid") so plugins can find it
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre><code${cls}>${escapeHtml(code || "")}</code></pre>\n`;
    }
  };

  r.link = function (href, title, text) {
    const safeHref = sanitizeHref(href);
    const isExternal = /^https?:\/\//i.test(safeHref);
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    const extra = isExternal ? ` data-external="1"` : "";
    const innerText = text != null ? String(text) : "";
    return `<a href="${escapeAttr(safeHref)}"${titleAttr}${extra}>${innerText}</a>`;
  };

  return r;
}

// Configure marked once
marked.setOptions({
  renderer: makeRenderer(),
  gfm: true,
  breaks: false,
  async: false
});

// ── DOMPurify config ──────────────────────────────────────────────────────
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "strong", "em", "del", "u", "s",
    "ul", "ol", "li", "input",
    "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td",
    "a", "img", "span", "div", "sup", "sub"
  ],
  ALLOWED_ATTR: [
    "id", "class", "href", "src", "alt", "title", "type", "checked", "disabled",
    "colspan", "rowspan", "data-external", "data-target-id"
  ],
  FORBID_ATTR: [
    "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur",
    "onchange", "oninput", "onsubmit", "onreset", "onkeydown", "onkeyup", "onkeypress"
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["data-external", "data-target-id"]
};

// ── Public API ────────────────────────────────────────────────────────────
export function renderMarkdown(md) {
  slugSeen.clear();
  if (!md) return "";
  const rawHtml = marked.parse(md);
  return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
}

export { slugify };
