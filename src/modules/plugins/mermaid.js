// mermaid.js — optional Mermaid diagram plugin (lazy-loaded)

let mermaidLib = null;
let enabled = false;
const KEY = "md-reader.plugin.mermaid";

export function isEnabled() {
  return enabled || localStorage.getItem(KEY) === "1";
}

export async function setEnabled(value) {
  enabled = !!value;
  localStorage.setItem(KEY, enabled ? "1" : "0");
  if (enabled && !mermaidLib) {
    try {
      const mod = await import("mermaid");
      mermaidLib = mod.default;
      mermaidLib.initialize({
        startOnLoad: false,
        theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: '"Inter", "Noto Sans SC", system-ui, sans-serif'
      });
    } catch (e) {
      console.error("Failed to load mermaid:", e);
      mermaidLib = null;
    }
  }
}

export function applyTheme(themeMode) {
  if (!mermaidLib) return;
  try {
    mermaidLib.initialize({
      startOnLoad: false,
      theme: themeMode === "dark" ? "dark" : "default",
      securityLevel: "strict",
      fontFamily: '"Inter", "Noto Sans SC", system-ui, sans-serif'
    });
  } catch (e) { /* ignore */ }
}

export async function processBlocks(rootEl) {
  if (!isEnabled() || !mermaidLib || !rootEl) return;
  const blocks = rootEl.querySelectorAll("pre code.language-mermaid");
  for (let i = 0; i < blocks.length; i++) {
    const code = blocks[i];
    const pre = code.parentElement;
    if (!pre || pre.dataset.processedMermaid === "1") continue;
    const src = code.textContent;
    const id = `mermaid-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const { svg } = await mermaidLib.render(id, src);
      const wrap = document.createElement("div");
      wrap.className = "mermaid-block";
      wrap.dataset.processedMermaid = "1";
      wrap.innerHTML = svg;
      pre.replaceWith(wrap);
    } catch (err) {
      pre.classList.add("mermaid-error");
      pre.title = `Mermaid render error: ${err.message || err}`;
    }
  }
}
