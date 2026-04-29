// katex.js — optional LaTeX math plugin (lazy-loaded)

let katexLib = null;
let enabled = false;
let cssLoaded = false;
const KEY = "md-reader.plugin.katex";

export function isEnabled() {
  return enabled || localStorage.getItem(KEY) === "1";
}

export async function setEnabled(value) {
  enabled = !!value;
  localStorage.setItem(KEY, enabled ? "1" : "0");
  if (enabled && !katexLib) {
    try {
      const mod = await import("katex");
      katexLib = mod.default;
      if (!cssLoaded) {
        // Load KaTeX CSS via dynamic import (handled by bundler)
        await import("katex/dist/katex.min.css");
        cssLoaded = true;
      }
    } catch (e) {
      console.error("Failed to load katex:", e);
      katexLib = null;
    }
  }
}

export function processBlocks(rootEl) {
  if (!isEnabled() || !katexLib || !rootEl) return;

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest("pre, code, .katex, .katex-display-block, .katex-inline")) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.nodeValue.includes("$")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach(node => {
    const parent = node.parentElement;
    if (!parent) return;
    const text = node.nodeValue;

    // Match $$...$$ first (display) then $...$ (inline)
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let lastIdx = 0;
    let match;
    const frag = document.createDocumentFragment();
    let found = false;

    while ((match = re.exec(text)) !== null) {
      found = true;
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const [whole, displayExpr, inlineExpr] = match;
      const expr = displayExpr || inlineExpr;
      const isDisplay = !!displayExpr;
      const span = document.createElement("span");
      span.className = isDisplay ? "katex-display-block" : "katex-inline";
      try {
        katexLib.render(expr, span, {
          displayMode: isDisplay,
          throwOnError: false,
          errorColor: "#EB5757"
        });
      } catch (err) {
        span.textContent = whole;
      }
      frag.appendChild(span);
      lastIdx = match.index + whole.length;
    }
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    if (found) parent.replaceChild(frag, node);
  });
}
