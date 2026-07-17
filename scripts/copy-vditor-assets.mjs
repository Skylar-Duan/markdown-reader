// copy-vditor-assets.mjs — stage Vditor's runtime assets into public/ for offline use.
//
// Vditor dynamically loads i18n files, content themes, and renderer engines from
// its `cdn` option at runtime. We point `cdn` at "vditor-assets" (served from
// public/), so everything must exist locally — the app has no network access
// guarantee. Only the engines our app actually supports are copied; exotic ones
// (abcjs music, smiles-drawer chemistry, echarts, markmap, graphviz, plantuml,
// mathjax) are skipped to keep the installer small.

import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "vditor", "dist");
const dest = path.join(root, "public", "vditor-assets", "dist");

if (!existsSync(src)) {
  console.error("vditor is not installed — run pnpm install first");
  process.exit(1);
}

const KEEP = [
  "index.css",
  "css",              // editor themes + content themes (light/dark)
  "images",           // logo / emoji referenced by css
  "js/i18n",          // en_US / ja_JP / ko_KR / zh_CN / zh_TW
  "js/icons",         // toolbar icon set
  "js/lute",          // markdown engine (loaded dynamically in some paths)
  "js/highlight.js",  // code highlight in IR preview
  "js/katex",         // math (app already ships KaTeX for read mode)
  "js/mermaid",       // diagrams (app already ships mermaid for read mode)
  "js/flowchart.js"   // cheap, occasionally used
];

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const rel of KEEP) {
  const from = path.join(src, rel);
  if (!existsSync(from)) {
    console.warn(`skip (not in package): ${rel}`);
    continue;
  }
  cpSync(from, path.join(dest, rel), { recursive: true });
}

console.log(`vditor assets staged → ${path.relative(root, dest)}`);
