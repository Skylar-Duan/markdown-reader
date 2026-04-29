# Markdown Reader 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个能装在 Windows 上、双击 .md 即用的桌面阅读器（Notion 风、5 语言、浅深主题、阅读+编辑双模式），最终产出 `.msi` 安装包。

**Architecture:** Tauri 2.x（Rust + WebView2）做桌面壳；前端用 Vanilla HTML/CSS/JS（不上前端框架）；marked + highlight.js + DOMPurify 做 Markdown 渲染；Tauri Bundler 直接产 MSI 安装包带文件关联。

**Tech Stack:**
- Rust 1.80+（通过 rustup 安装）/ Cargo
- Node.js 24（已装）/ pnpm
- Tauri 2.x
- marked v12 / highlight.js v11 / DOMPurify v3
- Lucide Icons（SVG）
- Inter + Noto Sans SC 字体

**前置文档：** [DESIGN.md](./DESIGN.md) — 完整设计规范（UI / 菜单 / 快捷键 / i18n / 安装）

---

## 文件结构（实施目标）

```
02-Gadgets/md-reader/
├── README.md                          [已存在]
├── DESIGN.md                          [已存在]
├── PLAN.md                            [本文件]
├── _design-mockups/ui-styles.html     [已存在]
├── package.json                       新建：前端依赖 + 脚本
├── pnpm-lock.yaml                     新建：依赖锁
├── .gitignore                         新建：忽略 node_modules/dist/target
├── src/                               新建
│   ├── index.html                     主页面骨架
│   ├── app.js                         入口 + 主循环
│   ├── styles/
│   │   ├── reset.css                  CSS reset
│   │   ├── layout.css                 4 区布局 (titlebar/menu/body/status)
│   │   ├── theme-light.css            浅色 token
│   │   ├── theme-dark.css             深色 token
│   │   └── markdown.css               MD 渲染样式
│   ├── modules/
│   │   ├── renderer.js                marked + sanitize
│   │   ├── toc.js                     大纲生成
│   │   ├── editor.js                  编辑模式
│   │   ├── modeSwitch.js              阅读/编辑切换
│   │   ├── theme.js                   主题切换
│   │   ├── i18n.js                    多语言
│   │   ├── menu.js                    顶部菜单
│   │   ├── statusbar.js               状态栏
│   │   ├── shortcuts.js               全局快捷键
│   │   ├── search.js                  Ctrl+F 查找
│   │   ├── fileOps.js                 文件读写（调 Tauri 命令）
│   │   ├── encoding.js                编码检测
│   │   └── plugins/
│   │       ├── mermaid.js             Mermaid 懒加载
│   │       └── katex.js               KaTeX 懒加载
│   ├── locales/
│   │   ├── zh-CN.json
│   │   ├── zh-TW.json
│   │   ├── en.json
│   │   ├── ja.json
│   │   └── ko.json
│   └── assets/
│       ├── icon.svg
│       └── fonts/                     Inter 子集 + 思源黑体子集
├── tests/                             新建：单元测试
│   ├── renderer.test.js
│   ├── toc.test.js
│   ├── i18n.test.js
│   └── encoding.test.js
├── src-tauri/                         新建（tauri init 生成）
│   ├── Cargo.toml
│   ├── tauri.conf.json                Tauri 主配置
│   ├── build.rs
│   ├── src/
│   │   ├── main.rs                    Rust 入口
│   │   └── commands.rs                Tauri commands
│   └── icons/                         多尺寸图标
└── dist/                              [build 产物，不提交]
    └── bundle/msi/Markdown Reader_1.0.0_x64_en-US.msi
```

---

## 阶段总览

| 阶段 | 任务 | 关键产出 |
|---|---|---|
| Phase 1 | 环境与脚手架 | Rust 装好 + Tauri 项目初始化跑通 |
| Phase 2 | 静态布局骨架 | 4 区 UI（标题栏/菜单/主体/状态栏）+ Notion 主题 |
| Phase 3 | 渲染核心 | MD 文本 → 安全 HTML（含代码高亮 + 大纲提取） |
| Phase 4 | 编辑模式 + 模式切换 | 阅读/编辑双态 + Ctrl+E + 未保存标识 |
| Phase 5 | 国际化 | 5 语言切换无重启 |
| Phase 6 | 菜单 / 快捷键 / 状态栏 / 查找 | 4 个顶部菜单 + 19 个快捷键 + Ctrl+F 浮窗 |
| Phase 7 | 文件操作 + 编码 | 4 种打开途径（双击 / 拖拽 / 菜单 / 命令行）+ 保存 + 大文件保护 + 编码自动识别 |
| Phase 8 | 插件 | Mermaid + KaTeX 懒加载 + 帮助菜单开关 |
| Phase 9 | 主题 | 浅 / 深 / 跟随系统 |
| Phase 10 | 打包 + 安装包 + 验收 | .msi 安装包，含卸载、文件关联、5 语言安装界面 |

---

## Phase 1：环境与脚手架

### Task 1.1：装 Rust 工具链

**Files:** N/A（系统级安装）

- [ ] **Step 1：下载 rustup-init 并执行（约 1.5GB，10-15 分钟）**

```bash
# Windows MSYS bash
cd /c/Users/dbwen/Downloads
curl --proto '=https' --tlsv1.2 -fsSL https://win.rustup.rs/x86_64 -o rustup-init.exe
./rustup-init.exe -y --default-toolchain stable --profile default
```

预期：装完后终端打印 `Rust is installed now. Great!`

- [ ] **Step 2：验证安装**

```bash
# 重启 bash 让 PATH 生效，或手动 source
export PATH="$USERPROFILE/.cargo/bin:$PATH"
rustc --version  # 期望: rustc 1.80.x 或更高
cargo --version  # 期望: cargo 1.80.x
```

- [ ] **Step 3：装 pnpm（前端包管理器）**

```bash
npm install -g pnpm
pnpm --version  # 期望: 9.x
```

- [ ] **Step 4：装 tauri CLI**

```bash
cargo install tauri-cli --version "^2.0" --locked
cargo tauri --version  # 期望: tauri-cli 2.x
```

### Task 1.2：初始化 Tauri 项目

**Files:**
- Create: `02-Gadgets/md-reader/package.json`
- Create: `02-Gadgets/md-reader/.gitignore`
- Create: `02-Gadgets/md-reader/src-tauri/*` (via tauri init)

- [ ] **Step 1：在 md-reader/ 目录初始化 npm 包**

```bash
cd "/c/Users/dbwen/Desktop/开发log/0. AI Engineering/Claude Code/project code/02-Gadgets/md-reader"
pnpm init
```

- [ ] **Step 2：编辑 package.json，写入脚本与依赖**

```json
{
  "name": "markdown-reader",
  "version": "1.0.0",
  "description": "A simple, beautiful Markdown reader for Windows",
  "scripts": {
    "tauri": "tauri",
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "vitest run"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "vitest": "^1.6.0"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "marked": "^12.0.0",
    "highlight.js": "^11.9.0",
    "dompurify": "^3.0.9"
  }
}
```

- [ ] **Step 3：安装依赖**

```bash
pnpm install
```

- [ ] **Step 4：用 tauri CLI 初始化 Rust 后端到 src-tauri/**

```bash
pnpm tauri init --ci \
  --app-name "Markdown Reader" \
  --window-title "Markdown Reader" \
  --frontend-dist "../src" \
  --dev-url "http://localhost:1430" \
  --before-dev-command "" \
  --before-build-command ""
```

- [ ] **Step 5：写 .gitignore**

```gitignore
# Node
node_modules/

# Rust
src-tauri/target/

# Build
dist/

# IDE
.vscode/
.idea/

# OS
Thumbs.db
.DS_Store
```

- [ ] **Step 6：放 placeholder index.html 跑通空白窗口**

`src/index.html`:
```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Markdown Reader</title></head>
<body><h1>Hello from Tauri</h1></body></html>
```

- [ ] **Step 7：跑开发模式，确认窗口打开**

```bash
pnpm tauri dev
```

预期：跳出一个 Windows 窗口显示 "Hello from Tauri"。
按 Ctrl+C 终止。

- [ ] **Step 8：commit**

```bash
cd "/c/Users/dbwen/Desktop/开发log/0. AI Engineering/Claude Code/project code/02-Gadgets/md-reader"
git init  # 还没初始化的话
git add .
git commit -m "feat: scaffold Tauri project with empty window"
```

---

## Phase 2：静态布局骨架（Notion 风）

### Task 2.1：CSS reset 与 4 区布局

**Files:**
- Create: `src/styles/reset.css`
- Create: `src/styles/layout.css`
- Modify: `src/index.html`

- [ ] **Step 1：写 reset.css**

`src/styles/reset.css`:
```css
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: "Inter", "Noto Sans SC", "PingFang SC", -apple-system, "Segoe UI", system-ui, sans-serif;
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
button { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }
ul, ol { list-style: none; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
```

- [ ] **Step 2：写 layout.css（4 区结构）**

`src/styles/layout.css`:
```css
.app {
  display: grid;
  grid-template-rows: 30px auto 1fr 24px;
  grid-template-columns: 240px 1fr;
  grid-template-areas:
    "titlebar titlebar"
    "menubar  menubar"
    "sidebar  content"
    "status   status";
  height: 100vh;
}
.titlebar {
  grid-area: titlebar;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  color: var(--text-secondary);
  -webkit-app-region: drag;
  user-select: none;
}
.titlebar .title { flex: 1; text-align: center; }
.menubar {
  grid-area: menubar;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 36px;
  font-size: 13px;
  gap: 4px;
}
.menubar .menu-item {
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.menubar .menu-item:hover { background: var(--bg-hover); }
.menubar .menu-spacer { flex: 1; }
.menubar .menu-right { display: flex; gap: 12px; align-items: center; }
.sidebar {
  grid-area: sidebar;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 18px 0;
}
.content {
  grid-area: content;
  overflow-y: auto;
  padding: 40px 56px;
}
.statusbar {
  grid-area: status;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 14px;
  font-size: 11px;
  color: var(--text-tertiary);
  gap: 16px;
}
.statusbar .spacer { flex: 1; }
.app[data-sidebar="hidden"] {
  grid-template-columns: 0 1fr;
}
.app[data-sidebar="hidden"] .sidebar { display: none; }
```

- [ ] **Step 3：改 index.html 写完整骨架**

`src/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Markdown Reader</title>
  <link rel="stylesheet" href="styles/reset.css">
  <link rel="stylesheet" href="styles/theme-light.css">
  <link rel="stylesheet" href="styles/theme-dark.css">
  <link rel="stylesheet" href="styles/layout.css">
  <link rel="stylesheet" href="styles/markdown.css">
</head>
<body>
  <div class="app" id="app">
    <header class="titlebar">
      <span class="title" id="window-title">Markdown Reader</span>
    </header>
    <nav class="menubar">
      <button class="menu-item" data-menu="file" data-i18n="menu.file">文件</button>
      <button class="menu-item" data-menu="edit" data-i18n="menu.edit">编辑</button>
      <button class="menu-item" data-menu="view" data-i18n="menu.view">视图</button>
      <button class="menu-item" data-menu="help" data-i18n="menu.help">帮助</button>
      <div class="menu-spacer"></div>
      <div class="menu-right">
        <button class="badge" id="lang-picker" title="Language">🌐 <span id="lang-label">中文</span></button>
        <button class="badge" id="theme-toggle" title="Theme">🌗</button>
        <button class="badge mode-btn" id="mode-toggle"><span id="mode-icon">📖</span> <span id="mode-label" data-i18n="mode.read">阅读</span></button>
      </div>
    </nav>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-label" data-i18n="toc.label">大纲</div>
      <ul class="toc" id="toc"></ul>
    </aside>
    <main class="content" id="content">
      <div id="renderer-output"></div>
      <textarea id="editor-input" hidden></textarea>
    </main>
    <footer class="statusbar">
      <span id="status-path">📄 未打开文件</span>
      <span id="status-encoding">UTF-8</span>
      <span id="status-stats">0 字</span>
      <div class="spacer"></div>
      <span id="status-mode" data-i18n="status.read_mode">📖 阅读模式</span>
      <span>Markdown</span>
    </footer>
  </div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4：写 placeholder app.js**

`src/app.js`:
```js
console.log("Markdown Reader booted");
```

- [ ] **Step 5：跑 pnpm tauri dev，目测 4 区布局正确**

期望：浏览器（开发模式）能看到完整骨架，白底 Notion 风，4 个顶部菜单按钮、侧栏标题、主区域空白、底部状态栏文字。

- [ ] **Step 6：commit**

```bash
git add src/styles/ src/index.html src/app.js
git commit -m "feat: 4-region layout skeleton with placeholder content"
```

### Task 2.2：浅色主题 token

**Files:**
- Create: `src/styles/theme-light.css`

- [ ] **Step 1：写完整 token**

`src/styles/theme-light.css`:
```css
html[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-sidebar: #F7F6F3;
  --bg-hover: #EBEAE7;
  --bg-active: #E5E3DF;
  --bg-overlay: rgba(0,0,0,0.4);
  --border: #EBEAE7;
  --border-strong: #D9D8D5;
  --text-primary: #37352F;
  --text-secondary: #787774;
  --text-tertiary: #9B9A97;
  --accent: #2F80ED;
  --accent-text: #FFFFFF;
  --code-bg: #F1EFEC;
  --code-block-bg: #F7F6F3;
  --code-text: #EB5757;
  --shadow-soft: 0 1px 3px rgba(0,0,0,0.04);
  --badge-bg: #F1EFEC;
  --badge-bg-hover: #E5E3DF;
  --pill-active-bg: #2F80ED;
  --pill-active-text: #FFFFFF;
  --warning: #E89B4B;
  --error: #EB5757;
  --success: #27AE60;
}

.badge {
  background: var(--badge-bg);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  border: none;
  cursor: pointer;
}
.badge:hover { background: var(--badge-bg-hover); }
.badge.active, .pill-active {
  background: var(--pill-active-bg);
  color: var(--pill-active-text);
}
.sidebar-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 0 20px 10px;
}
.toc-item {
  padding: 5px 20px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
  margin: 0 8px;
  color: var(--text-primary);
}
.toc-item:hover { background: var(--bg-hover); }
.toc-item.active { background: var(--bg-active); font-weight: 600; }
.toc-h1 { padding-left: 12px; font-weight: 500; }
.toc-h2 { padding-left: 24px; }
.toc-h3 { padding-left: 36px; font-size: 12px; }
.toc-h4 { padding-left: 48px; font-size: 12px; color: var(--text-secondary); }
```

- [ ] **Step 2：刷新 dev，目测颜色对**

期望：背景纯白、侧栏暖灰、文字柔和深灰、菜单按钮 hover 出浅灰背景。

- [ ] **Step 3：commit**

```bash
git add src/styles/theme-light.css
git commit -m "feat: Notion-style light theme tokens"
```

### Task 2.3：深色主题 token

**Files:**
- Create: `src/styles/theme-dark.css`

- [ ] **Step 1：写深色 token**

`src/styles/theme-dark.css`:
```css
html[data-theme="dark"] {
  --bg-primary: #191919;
  --bg-sidebar: #202020;
  --bg-hover: #2A2A2A;
  --bg-active: #333333;
  --bg-overlay: rgba(0,0,0,0.6);
  --border: #2F2F2F;
  --border-strong: #3F3F3F;
  --text-primary: #E8E6E3;
  --text-secondary: #9B9B96;
  --text-tertiary: #6E6E68;
  --accent: #5499F8;
  --accent-text: #FFFFFF;
  --code-bg: #2D2D2D;
  --code-block-bg: #202020;
  --code-text: #FF7B72;
  --shadow-soft: 0 1px 3px rgba(0,0,0,0.4);
  --badge-bg: #2A2A2A;
  --badge-bg-hover: #333333;
  --pill-active-bg: #5499F8;
  --pill-active-text: #FFFFFF;
  --warning: #E89B4B;
  --error: #FF7B72;
  --success: #4ECC8B;
}
```

- [ ] **Step 2：临时把 `<html data-theme="dark">` 试切，目测**

修改 index.html `<html lang="zh-CN" data-theme="dark">` 然后 reload。预期：所有颜色翻转，仍然清爽。改回 `data-theme="light"`。

- [ ] **Step 3：commit**

```bash
git add src/styles/theme-dark.css
git commit -m "feat: Notion-style dark theme tokens"
```

### Task 2.4：Markdown 渲染样式

**Files:**
- Create: `src/styles/markdown.css`

- [ ] **Step 1：写 MD 内容样式**

`src/styles/markdown.css`:
```css
#renderer-output {
  max-width: 880px;
  font-family: "Inter", "Noto Sans SC", system-ui, sans-serif;
  color: var(--text-primary);
}
#renderer-output h1 {
  font-size: 36px; font-weight: 700; letter-spacing: -0.5px;
  margin: 0 0 4px 0;
}
#renderer-output h2 {
  font-size: 24px; font-weight: 600; letter-spacing: -0.3px;
  margin: 28px 0 8px 0;
}
#renderer-output h3 {
  font-size: 19px; font-weight: 600; margin: 22px 0 6px 0;
}
#renderer-output h4 {
  font-size: 16px; font-weight: 600; margin: 18px 0 4px 0;
}
#renderer-output p {
  font-size: 15.5px; line-height: 1.7;
  margin-bottom: 12px;
}
#renderer-output ul, #renderer-output ol {
  font-size: 15.5px; line-height: 1.7; padding-left: 24px; margin-bottom: 12px;
}
#renderer-output ul { list-style: disc; }
#renderer-output ol { list-style: decimal; }
#renderer-output blockquote {
  border-left: 3px solid var(--text-primary);
  padding: 4px 0 4px 16px;
  margin: 16px 0;
  color: var(--text-primary);
  font-size: 15.5px;
}
#renderer-output code:not(pre code) {
  background: var(--code-bg);
  color: var(--code-text);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
  font-size: 13.5px;
}
#renderer-output pre {
  background: var(--code-block-bg);
  border: 1px solid var(--border);
  padding: 14px 16px;
  border-radius: 4px;
  margin: 14px 0;
  overflow-x: auto;
}
#renderer-output pre code {
  font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}
#renderer-output table {
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 14px;
}
#renderer-output th, #renderer-output td {
  border: 1px solid var(--border);
  padding: 8px 14px;
  text-align: left;
}
#renderer-output th { background: var(--bg-sidebar); font-weight: 600; }
#renderer-output hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}
#renderer-output img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
#renderer-output strong { font-weight: 700; }
#renderer-output em { font-style: italic; }
#renderer-output del { text-decoration: line-through; opacity: 0.7; }
#renderer-output input[type="checkbox"] {
  margin-right: 6px; vertical-align: middle;
}

#editor-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
  font-size: 14px;
  line-height: 1.7;
  padding: 0;
}
```

- [ ] **Step 2：commit**

```bash
git add src/styles/markdown.css
git commit -m "feat: markdown rendering styles (Notion-flavor)"
```

---

## Phase 3：渲染核心

### Task 3.1：renderer.js（marked + sanitize）— TDD

**Files:**
- Create: `src/modules/renderer.js`
- Create: `tests/renderer.test.js`

- [ ] **Step 1：装测试框架**

```bash
pnpm add -D vitest jsdom @vitest/ui
```

`vitest.config.js`:
```js
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", globals: true }
});
```

- [ ] **Step 2：写 renderer 失败测试**

`tests/renderer.test.js`:
```js
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/modules/renderer.js";

describe("renderMarkdown", () => {
  it("renders heading", () => {
    const html = renderMarkdown("# Hello");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
  });

  it("renders code block with language class", () => {
    const html = renderMarkdown("```python\nprint('hi')\n```");
    expect(html).toContain("hljs");
    expect(html).toContain("language-python");
  });

  it("renders table (GFM)", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
  });

  it("strips inline scripts", () => {
    const html = renderMarkdown('<script>alert(1)</script>Hello');
    expect(html).not.toContain("<script>");
    expect(html).toContain("Hello");
  });

  it("strips on* attributes", () => {
    const html = renderMarkdown('<a href="x" onclick="alert(1)">link</a>');
    expect(html).not.toMatch(/onclick=/i);
  });

  it("adds id to headings for TOC anchoring", () => {
    const html = renderMarkdown("## My Section");
    expect(html).toMatch(/<h2 id="[^"]+">/);
  });
});
```

- [ ] **Step 3：跑测试，确认全部失败**

```bash
pnpm test
```
预期：6 个 failed（function not defined）

- [ ] **Step 4：实现 renderer.js**

`src/modules/renderer.js`:
```js
import { marked } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";

// Slugify heading text → id
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w一-鿿\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "section";
}

// Custom renderer: add id to headings, syntax highlight code blocks
const renderer = new marked.Renderer();
const slugSeen = new Map();

renderer.heading = ({ text, depth, tokens }) => {
  const plain = tokens
    ? tokens.map(t => t.text || t.raw || "").join("")
    : text;
  const base = slugify(plain);
  const count = (slugSeen.get(base) || 0) + 1;
  slugSeen.set(base, count);
  const id = count > 1 ? `${base}-${count}` : base;
  return `<h${depth} id="${id}">${plain}</h${depth}>\n`;
};

renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: false
});

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "h1","h2","h3","h4","h5","h6",
    "p","br","hr","strong","em","del","u",
    "ul","ol","li","input",
    "blockquote","pre","code",
    "table","thead","tbody","tr","th","td",
    "a","img","span","div"
  ],
  ALLOWED_ATTR: ["id","class","href","src","alt","title","type","checked","disabled","colspan","rowspan"],
  FORBID_ATTR: ["onerror","onload","onclick","onmouseover","onfocus","onblur","onchange","oninput"],
  ALLOW_DATA_ATTR: false
};

export function renderMarkdown(md) {
  slugSeen.clear();
  const rawHtml = marked.parse(md || "");
  return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
}

export { slugify };
```

- [ ] **Step 5：跑测试，确认全部通过**

```bash
pnpm test
```
预期：6 passed

- [ ] **Step 6：commit**

```bash
git add src/modules/renderer.js tests/renderer.test.js vitest.config.js package.json
git commit -m "feat: markdown renderer with sanitization and code highlight"
```

### Task 3.2：toc.js（大纲提取）— TDD

**Files:**
- Create: `src/modules/toc.js`
- Create: `tests/toc.test.js`

- [ ] **Step 1：写失败测试**

`tests/toc.test.js`:
```js
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

  it("returns empty for no headings", () => {
    expect(extractTOC("<p>just text</p>")).toEqual([]);
  });

  it("strips inner tags from heading text", () => {
    const html = `<h2 id="x"><strong>Bold</strong> Title</h2>`;
    expect(extractTOC(html)[0].text).toBe("Bold Title");
  });
});
```

- [ ] **Step 2：跑测试确认失败**

```bash
pnpm test toc
```

- [ ] **Step 3：实现 toc.js**

`src/modules/toc.js`:
```js
export function extractTOC(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  return Array.from(headings).map(h => ({
    id: h.id,
    depth: parseInt(h.tagName.substring(1), 10),
    text: h.textContent.trim()
  }));
}

export function renderTOC(tocItems, container) {
  container.innerHTML = "";
  tocItems.forEach(item => {
    const li = document.createElement("li");
    li.className = `toc-item toc-h${item.depth}`;
    li.textContent = item.text;
    li.dataset.targetId = item.id;
    li.addEventListener("click", () => {
      const target = document.getElementById(item.id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        container.querySelectorAll(".toc-item").forEach(i => i.classList.remove("active"));
        li.classList.add("active");
      }
    });
    container.appendChild(li);
  });
}
```

- [ ] **Step 4：跑测试确认通过**

- [ ] **Step 5：commit**

```bash
git add src/modules/toc.js tests/toc.test.js
git commit -m "feat: TOC extraction and rendering"
```

### Task 3.3：integrate renderer + TOC into app.js

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1：改 app.js 写 boot 逻辑**

`src/app.js`:
```js
import { renderMarkdown } from "./modules/renderer.js";
import { extractTOC, renderTOC } from "./modules/toc.js";

// Sample markdown for initial display (will be replaced by file loader later)
const SAMPLE_MD = `# Markdown Reader

欢迎使用 **Markdown 阅读器**。这是一个示例文档。

## 功能特性

- 漂亮的 Notion 风格渲染
- 支持代码高亮
- 中英双语界面

\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\`

## 表格示例

| 功能 | 状态 |
|------|------|
| 阅读 | ✅ |
| 编辑 | ✅ |

> 提示：按 Ctrl+E 切换阅读 / 编辑模式。
`;

const state = {
  filePath: null,
  rawText: SAMPLE_MD,
  mode: "read"  // "read" | "edit"
};

function rerender() {
  const html = renderMarkdown(state.rawText);
  const output = document.getElementById("renderer-output");
  output.innerHTML = html;

  const toc = extractTOC(html);
  renderTOC(toc, document.getElementById("toc"));
}

document.addEventListener("DOMContentLoaded", () => {
  rerender();
});

// Expose state for debugging
window.__app = { state, rerender };
```

- [ ] **Step 2：跑 dev，目测：默认看到 sample MD 渲染漂亮，侧栏出现两个 H2 大纲项**

```bash
pnpm tauri dev
```

- [ ] **Step 3：commit**

```bash
git add src/app.js
git commit -m "feat: wire renderer and TOC into app boot"
```

### Task 3.4：装 highlight.js 主题样式

**Files:**
- Modify: `src/index.html`
- Create: `src/styles/highlight-light.css`（直接复制 highlight.js 的 github.css）
- Create: `src/styles/highlight-dark.css`（github-dark.css）

- [ ] **Step 1：从 highlight.js 包复制主题**

```bash
cp node_modules/highlight.js/styles/github.css src/styles/highlight-light.css
cp node_modules/highlight.js/styles/github-dark.css src/styles/highlight-dark.css
```

- [ ] **Step 2：在 index.html 引入（用 prefers-color 切换或基于 data-theme）**

把以下加到 head（在 markdown.css 后）：
```html
<link rel="stylesheet" href="styles/highlight-light.css" id="hljs-light">
<link rel="stylesheet" href="styles/highlight-dark.css" id="hljs-dark" disabled>
```

- [ ] **Step 3：在 app.js 加切换逻辑（先简单根据 data-theme）**

`src/app.js` 加：
```js
function applyHljsTheme() {
  const isDark = document.documentElement.dataset.theme === "dark";
  document.getElementById("hljs-light").disabled = isDark;
  document.getElementById("hljs-dark").disabled = !isDark;
}
applyHljsTheme();
```

- [ ] **Step 4：目测代码块出现配色**

- [ ] **Step 5：commit**

```bash
git add src/styles/highlight-*.css src/index.html src/app.js
git commit -m "feat: integrate highlight.js github themes"
```

---

## Phase 4：编辑模式 + 模式切换

### Task 4.1：editor.js + 模式切换

**Files:**
- Create: `src/modules/editor.js`
- Create: `src/modules/modeSwitch.js`
- Modify: `src/app.js`

- [ ] **Step 1：写 editor.js**

`src/modules/editor.js`:
```js
let dirty = false;
let textarea = null;

export function initEditor(textareaEl, onChange) {
  textarea = textareaEl;
  textarea.addEventListener("input", () => {
    dirty = true;
    onChange?.(textarea.value);
  });
}

export function setText(text) {
  if (textarea) {
    textarea.value = text;
    dirty = false;
  }
}

export function getText() {
  return textarea ? textarea.value : "";
}

export function isDirty() {
  return dirty;
}

export function clearDirty() {
  dirty = false;
}

export function focus() {
  textarea?.focus();
}
```

- [ ] **Step 2：写 modeSwitch.js**

`src/modules/modeSwitch.js`:
```js
const I18N_KEYS = {
  read: { icon: "📖", labelKey: "mode.read", statusKey: "status.read_mode" },
  edit: { icon: "✏️", labelKey: "mode.edit", statusKey: "status.edit_mode" }
};

export function applyMode(mode, { onAfterSwitch } = {}) {
  const isEdit = mode === "edit";
  document.getElementById("renderer-output").hidden = isEdit;
  document.getElementById("editor-input").hidden = !isEdit;
  document.getElementById("mode-icon").textContent = I18N_KEYS[mode].icon;

  // Label translation will be applied by i18n module after this
  const modeLabel = document.getElementById("mode-label");
  modeLabel.dataset.i18n = I18N_KEYS[mode].labelKey;
  document.getElementById("status-mode").dataset.i18n = I18N_KEYS[mode].statusKey;

  document.getElementById("mode-toggle").classList.toggle("active", true);

  onAfterSwitch?.(mode);
}
```

- [ ] **Step 3：改 app.js 接通模式切换**

在 `src/app.js` 增加：
```js
import { initEditor, setText as setEditorText, getText as getEditorText } from "./modules/editor.js";
import { applyMode } from "./modules/modeSwitch.js";

function switchMode(newMode) {
  // 离开 edit 模式时，把 textarea 内容拿回 state
  if (state.mode === "edit" && newMode === "read") {
    state.rawText = getEditorText();
    rerender();
  }
  // 进入 edit 模式时，把 state 内容塞进 textarea
  if (state.mode === "read" && newMode === "edit") {
    setEditorText(state.rawText);
  }
  state.mode = newMode;
  applyMode(newMode);
}

document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("editor-input");
  initEditor(textarea, (newText) => {
    state.rawText = newText;
  });
  applyMode(state.mode);
  rerender();

  document.getElementById("mode-toggle").addEventListener("click", () => {
    switchMode(state.mode === "read" ? "edit" : "read");
  });
});

window.__app.switchMode = switchMode;
```

- [ ] **Step 4：dev 测：点右上角 📖/✏️ 按钮切换，编辑后切回阅读能看到改动**

- [ ] **Step 5：commit**

```bash
git add src/modules/editor.js src/modules/modeSwitch.js src/app.js
git commit -m "feat: read/edit mode switch with content sync"
```

---

## Phase 5：国际化（i18n）

### Task 5.1：5 个 locale 文件

**Files:**
- Create: `src/locales/zh-CN.json`
- Create: `src/locales/zh-TW.json`
- Create: `src/locales/en.json`
- Create: `src/locales/ja.json`
- Create: `src/locales/ko.json`

- [ ] **Step 1：写 zh-CN.json（基准）**

`src/locales/zh-CN.json`:
```json
{
  "menu.file": "文件",
  "menu.edit": "编辑",
  "menu.view": "视图",
  "menu.help": "帮助",
  "menu.file.open": "打开...",
  "menu.file.recent": "最近打开",
  "menu.file.save": "保存",
  "menu.file.save_as": "另存为...",
  "menu.file.print": "打印",
  "menu.file.set_default": "设为 .md 默认打开方式",
  "menu.file.close": "关闭",
  "menu.edit.undo": "撤销",
  "menu.edit.redo": "重做",
  "menu.edit.cut": "剪切",
  "menu.edit.copy": "复制",
  "menu.edit.paste": "粘贴",
  "menu.edit.select_all": "全选",
  "menu.edit.find": "查找",
  "menu.view.read": "阅读模式",
  "menu.view.edit": "编辑模式",
  "menu.view.toc": "显示大纲",
  "menu.view.theme_light": "浅色主题",
  "menu.view.theme_dark": "深色主题",
  "menu.view.theme_auto": "跟随系统",
  "menu.view.zoom_in": "放大字号",
  "menu.view.zoom_out": "缩小字号",
  "menu.view.zoom_reset": "重置字号",
  "menu.help.usage": "使用说明",
  "menu.help.mermaid": "启用 Mermaid 流程图",
  "menu.help.katex": "启用 LaTeX 数学公式",
  "menu.help.language": "切换语言",
  "menu.help.about": "关于",
  "mode.read": "阅读",
  "mode.edit": "编辑",
  "status.read_mode": "📖 阅读模式",
  "status.edit_mode": "✏️ 编辑模式",
  "status.no_file": "📄 未打开文件",
  "status.dirty": "● 未保存",
  "status.chars": "{n} 字",
  "toc.label": "大纲",
  "toc.empty": "（无标题）",
  "dialog.unsaved.title": "保存修改？",
  "dialog.unsaved.body": "「{file}」已修改但未保存。",
  "dialog.unsaved.save": "保存",
  "dialog.unsaved.discard": "不保存",
  "dialog.unsaved.cancel": "取消",
  "dialog.large_file.title": "文件较大",
  "dialog.large_file.body": "文件大小为 {size}，加载可能较慢。是否继续？",
  "dialog.too_large.title": "文件过大",
  "dialog.too_large.body": "文件大小为 {size}，超过 20MB 限制。建议使用专业编辑器打开。",
  "dialog.continue": "继续",
  "dialog.cancel": "取消",
  "dialog.encoding.title": "选择编码",
  "dialog.encoding.body": "无法自动识别此文件编码，请选择：",
  "search.placeholder": "查找...",
  "search.results": "{current} / {total}",
  "search.no_results": "无匹配",
  "about.title": "关于 Markdown Reader",
  "about.version": "版本 {version}",
  "about.tagline": "为 .md 而生的轻量阅读器",
  "welcome.title": "欢迎使用 Markdown Reader",
  "welcome.hint": "拖入 .md 文件，或按 Ctrl+O 打开",
  "welcome.recent": "最近打开"
}
```

- [ ] **Step 2：写 en.json**

`src/locales/en.json`:
```json
{
  "menu.file": "File",
  "menu.edit": "Edit",
  "menu.view": "View",
  "menu.help": "Help",
  "menu.file.open": "Open...",
  "menu.file.recent": "Recent files",
  "menu.file.save": "Save",
  "menu.file.save_as": "Save As...",
  "menu.file.print": "Print",
  "menu.file.set_default": "Set as default for .md files",
  "menu.file.close": "Close",
  "menu.edit.undo": "Undo",
  "menu.edit.redo": "Redo",
  "menu.edit.cut": "Cut",
  "menu.edit.copy": "Copy",
  "menu.edit.paste": "Paste",
  "menu.edit.select_all": "Select All",
  "menu.edit.find": "Find",
  "menu.view.read": "Read Mode",
  "menu.view.edit": "Edit Mode",
  "menu.view.toc": "Show Outline",
  "menu.view.theme_light": "Light Theme",
  "menu.view.theme_dark": "Dark Theme",
  "menu.view.theme_auto": "Follow System",
  "menu.view.zoom_in": "Zoom In",
  "menu.view.zoom_out": "Zoom Out",
  "menu.view.zoom_reset": "Reset Zoom",
  "menu.help.usage": "Help",
  "menu.help.mermaid": "Enable Mermaid diagrams",
  "menu.help.katex": "Enable LaTeX math",
  "menu.help.language": "Language",
  "menu.help.about": "About",
  "mode.read": "Read",
  "mode.edit": "Edit",
  "status.read_mode": "📖 Read Mode",
  "status.edit_mode": "✏️ Edit Mode",
  "status.no_file": "📄 No file open",
  "status.dirty": "● Unsaved",
  "status.chars": "{n} chars",
  "toc.label": "Outline",
  "toc.empty": "(No headings)",
  "dialog.unsaved.title": "Save changes?",
  "dialog.unsaved.body": "\"{file}\" has been modified.",
  "dialog.unsaved.save": "Save",
  "dialog.unsaved.discard": "Discard",
  "dialog.unsaved.cancel": "Cancel",
  "dialog.large_file.title": "Large file",
  "dialog.large_file.body": "File size is {size}. Loading may be slow. Continue?",
  "dialog.too_large.title": "File too large",
  "dialog.too_large.body": "File size is {size}, exceeding 20MB limit. Use a professional editor.",
  "dialog.continue": "Continue",
  "dialog.cancel": "Cancel",
  "dialog.encoding.title": "Choose encoding",
  "dialog.encoding.body": "Could not auto-detect encoding. Please choose:",
  "search.placeholder": "Find...",
  "search.results": "{current} / {total}",
  "search.no_results": "No matches",
  "about.title": "About Markdown Reader",
  "about.version": "Version {version}",
  "about.tagline": "A lightweight reader designed for .md files",
  "welcome.title": "Welcome to Markdown Reader",
  "welcome.hint": "Drop a .md file, or press Ctrl+O to open",
  "welcome.recent": "Recent files"
}
```

- [ ] **Step 3：基于 zh-CN 写 zh-TW.json（繁中）**

机翻 + 调整地道用语：
```json
{
  "menu.file": "檔案",
  "menu.edit": "編輯",
  "menu.view": "檢視",
  "menu.help": "說明",
  "menu.file.open": "開啟...",
  "menu.file.recent": "最近開啟",
  "menu.file.save": "儲存",
  "menu.file.save_as": "另存新檔...",
  "menu.file.print": "列印",
  "menu.file.set_default": "設為 .md 預設開啟方式",
  "menu.file.close": "關閉",
  "menu.edit.undo": "復原",
  "menu.edit.redo": "重做",
  "menu.edit.cut": "剪下",
  "menu.edit.copy": "複製",
  "menu.edit.paste": "貼上",
  "menu.edit.select_all": "全選",
  "menu.edit.find": "尋找",
  "menu.view.read": "閱讀模式",
  "menu.view.edit": "編輯模式",
  "menu.view.toc": "顯示大綱",
  "menu.view.theme_light": "淺色主題",
  "menu.view.theme_dark": "深色主題",
  "menu.view.theme_auto": "跟隨系統",
  "menu.view.zoom_in": "放大字級",
  "menu.view.zoom_out": "縮小字級",
  "menu.view.zoom_reset": "重設字級",
  "menu.help.usage": "使用說明",
  "menu.help.mermaid": "啟用 Mermaid 流程圖",
  "menu.help.katex": "啟用 LaTeX 數學公式",
  "menu.help.language": "切換語言",
  "menu.help.about": "關於",
  "mode.read": "閱讀",
  "mode.edit": "編輯",
  "status.read_mode": "📖 閱讀模式",
  "status.edit_mode": "✏️ 編輯模式",
  "status.no_file": "📄 未開啟檔案",
  "status.dirty": "● 未儲存",
  "status.chars": "{n} 字",
  "toc.label": "大綱",
  "toc.empty": "（無標題）",
  "dialog.unsaved.title": "儲存變更？",
  "dialog.unsaved.body": "「{file}」已修改但未儲存。",
  "dialog.unsaved.save": "儲存",
  "dialog.unsaved.discard": "不儲存",
  "dialog.unsaved.cancel": "取消",
  "dialog.large_file.title": "檔案較大",
  "dialog.large_file.body": "檔案大小為 {size}，載入可能較慢。是否繼續？",
  "dialog.too_large.title": "檔案過大",
  "dialog.too_large.body": "檔案大小為 {size}，超過 20MB 限制。建議使用專業編輯器開啟。",
  "dialog.continue": "繼續",
  "dialog.cancel": "取消",
  "dialog.encoding.title": "選擇編碼",
  "dialog.encoding.body": "無法自動辨識此檔案編碼，請選擇：",
  "search.placeholder": "尋找...",
  "search.results": "{current} / {total}",
  "search.no_results": "無相符項目",
  "about.title": "關於 Markdown Reader",
  "about.version": "版本 {version}",
  "about.tagline": "為 .md 而生的輕量閱讀器",
  "welcome.title": "歡迎使用 Markdown Reader",
  "welcome.hint": "拖入 .md 檔案，或按 Ctrl+O 開啟",
  "welcome.recent": "最近開啟"
}
```

- [ ] **Step 4：写 ja.json**

`src/locales/ja.json`:
```json
{
  "menu.file": "ファイル",
  "menu.edit": "編集",
  "menu.view": "表示",
  "menu.help": "ヘルプ",
  "menu.file.open": "開く...",
  "menu.file.recent": "最近のファイル",
  "menu.file.save": "保存",
  "menu.file.save_as": "名前を付けて保存...",
  "menu.file.print": "印刷",
  "menu.file.set_default": ".md の既定アプリに設定",
  "menu.file.close": "閉じる",
  "menu.edit.undo": "元に戻す",
  "menu.edit.redo": "やり直し",
  "menu.edit.cut": "切り取り",
  "menu.edit.copy": "コピー",
  "menu.edit.paste": "貼り付け",
  "menu.edit.select_all": "すべて選択",
  "menu.edit.find": "検索",
  "menu.view.read": "読書モード",
  "menu.view.edit": "編集モード",
  "menu.view.toc": "アウトライン表示",
  "menu.view.theme_light": "ライトテーマ",
  "menu.view.theme_dark": "ダークテーマ",
  "menu.view.theme_auto": "システムに従う",
  "menu.view.zoom_in": "拡大",
  "menu.view.zoom_out": "縮小",
  "menu.view.zoom_reset": "ズームをリセット",
  "menu.help.usage": "使い方",
  "menu.help.mermaid": "Mermaid 図を有効化",
  "menu.help.katex": "LaTeX 数式を有効化",
  "menu.help.language": "言語",
  "menu.help.about": "情報",
  "mode.read": "読書",
  "mode.edit": "編集",
  "status.read_mode": "📖 読書モード",
  "status.edit_mode": "✏️ 編集モード",
  "status.no_file": "📄 ファイル未開封",
  "status.dirty": "● 未保存",
  "status.chars": "{n} 文字",
  "toc.label": "アウトライン",
  "toc.empty": "（見出しなし）",
  "dialog.unsaved.title": "変更を保存しますか？",
  "dialog.unsaved.body": "「{file}」は変更されていますが保存されていません。",
  "dialog.unsaved.save": "保存",
  "dialog.unsaved.discard": "保存しない",
  "dialog.unsaved.cancel": "キャンセル",
  "dialog.large_file.title": "大きなファイル",
  "dialog.large_file.body": "ファイルサイズは {size} です。読み込みに時間がかかる可能性があります。続行しますか？",
  "dialog.too_large.title": "ファイルが大きすぎます",
  "dialog.too_large.body": "ファイルサイズは {size} で、20MB の上限を超えています。専門のエディタを使用してください。",
  "dialog.continue": "続行",
  "dialog.cancel": "キャンセル",
  "dialog.encoding.title": "エンコーディングを選択",
  "dialog.encoding.body": "エンコーディングを自動検出できませんでした。選択してください：",
  "search.placeholder": "検索...",
  "search.results": "{current} / {total}",
  "search.no_results": "一致なし",
  "about.title": "Markdown Reader について",
  "about.version": "バージョン {version}",
  "about.tagline": ".md のために設計された軽量リーダー",
  "welcome.title": "Markdown Reader へようこそ",
  "welcome.hint": ".md ファイルをドロップするか、Ctrl+O で開きます",
  "welcome.recent": "最近のファイル"
}
```

- [ ] **Step 5：写 ko.json**

`src/locales/ko.json`:
```json
{
  "menu.file": "파일",
  "menu.edit": "편집",
  "menu.view": "보기",
  "menu.help": "도움말",
  "menu.file.open": "열기...",
  "menu.file.recent": "최근 항목",
  "menu.file.save": "저장",
  "menu.file.save_as": "다른 이름으로 저장...",
  "menu.file.print": "인쇄",
  "menu.file.set_default": ".md 기본 앱으로 설정",
  "menu.file.close": "닫기",
  "menu.edit.undo": "실행 취소",
  "menu.edit.redo": "다시 실행",
  "menu.edit.cut": "잘라내기",
  "menu.edit.copy": "복사",
  "menu.edit.paste": "붙여넣기",
  "menu.edit.select_all": "모두 선택",
  "menu.edit.find": "찾기",
  "menu.view.read": "읽기 모드",
  "menu.view.edit": "편집 모드",
  "menu.view.toc": "개요 표시",
  "menu.view.theme_light": "밝은 테마",
  "menu.view.theme_dark": "어두운 테마",
  "menu.view.theme_auto": "시스템 따름",
  "menu.view.zoom_in": "확대",
  "menu.view.zoom_out": "축소",
  "menu.view.zoom_reset": "크기 초기화",
  "menu.help.usage": "사용법",
  "menu.help.mermaid": "Mermaid 다이어그램 활성화",
  "menu.help.katex": "LaTeX 수식 활성화",
  "menu.help.language": "언어",
  "menu.help.about": "정보",
  "mode.read": "읽기",
  "mode.edit": "편집",
  "status.read_mode": "📖 읽기 모드",
  "status.edit_mode": "✏️ 편집 모드",
  "status.no_file": "📄 열린 파일 없음",
  "status.dirty": "● 저장되지 않음",
  "status.chars": "{n}자",
  "toc.label": "개요",
  "toc.empty": "(제목 없음)",
  "dialog.unsaved.title": "변경 사항을 저장하시겠습니까?",
  "dialog.unsaved.body": "「{file}」이(가) 수정되었지만 저장되지 않았습니다.",
  "dialog.unsaved.save": "저장",
  "dialog.unsaved.discard": "저장 안 함",
  "dialog.unsaved.cancel": "취소",
  "dialog.large_file.title": "큰 파일",
  "dialog.large_file.body": "파일 크기가 {size}입니다. 로드가 느릴 수 있습니다. 계속하시겠습니까?",
  "dialog.too_large.title": "파일이 너무 큼",
  "dialog.too_large.body": "파일 크기가 {size}로 20MB 제한을 초과합니다. 전문 편집기를 사용하세요.",
  "dialog.continue": "계속",
  "dialog.cancel": "취소",
  "dialog.encoding.title": "인코딩 선택",
  "dialog.encoding.body": "인코딩을 자동 감지할 수 없습니다. 선택하세요:",
  "search.placeholder": "찾기...",
  "search.results": "{current} / {total}",
  "search.no_results": "일치하는 항목 없음",
  "about.title": "Markdown Reader 정보",
  "about.version": "버전 {version}",
  "about.tagline": ".md를 위한 가벼운 리더",
  "welcome.title": "Markdown Reader에 오신 것을 환영합니다",
  "welcome.hint": ".md 파일을 끌어다 놓거나 Ctrl+O를 눌러 여세요",
  "welcome.recent": "최근 항목"
}
```

- [ ] **Step 6：commit**

```bash
git add src/locales/
git commit -m "feat: add 5 locale files (zh-CN, zh-TW, en, ja, ko)"
```

### Task 5.2：i18n.js 模块 — TDD

**Files:**
- Create: `src/modules/i18n.js`
- Create: `tests/i18n.test.js`

- [ ] **Step 1：写测试**

`tests/i18n.test.js`:
```js
import { describe, it, expect, beforeEach } from "vitest";
import { I18n } from "../src/modules/i18n.js";

const en = { "hi": "Hello", "stat": "{n} files" };
const zh = { "hi": "你好", "stat": "{n} 个文件" };

describe("I18n", () => {
  let i18n;
  beforeEach(() => {
    i18n = new I18n({ "en": en, "zh-CN": zh }, "en");
  });

  it("returns string for known key", () => {
    expect(i18n.t("hi")).toBe("Hello");
  });

  it("interpolates {n}", () => {
    expect(i18n.t("stat", { n: 5 })).toBe("5 files");
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
});
```

- [ ] **Step 2：跑测试确认失败**

- [ ] **Step 3：实现 i18n.js**

`src/modules/i18n.js`:
```js
export class I18n {
  constructor(locales, defaultLocale = "en") {
    this.locales = locales;
    this.defaultLocale = defaultLocale;
    this.currentLocale = defaultLocale;
    this.listeners = [];
  }

  t(key, params = {}) {
    const dict = this.locales[this.currentLocale] || this.locales[this.defaultLocale] || {};
    const fallback = this.locales[this.defaultLocale] || {};
    const template = dict[key] ?? fallback[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
  }

  setLocale(locale) {
    this.currentLocale = locale;
    this.listeners.forEach(fn => fn(locale));
  }

  onChange(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  applyToDOM(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
  }
}

export async function loadLocales() {
  const codes = ["zh-CN", "zh-TW", "en", "ja", "ko"];
  const locales = {};
  for (const code of codes) {
    const res = await fetch(`./locales/${code}.json`);
    locales[code] = await res.json();
  }
  return locales;
}

export function detectInitialLocale() {
  const stored = localStorage.getItem("md-reader.locale");
  if (stored) return stored;

  const sys = (navigator.language || "en").toLowerCase();
  if (sys.startsWith("zh-tw") || sys.startsWith("zh-hk")) return "zh-TW";
  if (sys.startsWith("zh")) return "zh-CN";
  if (sys.startsWith("ja")) return "ja";
  if (sys.startsWith("ko")) return "ko";
  return "en";
}
```

- [ ] **Step 4：跑测试通过**

- [ ] **Step 5：把 i18n 接入 app.js**

在 `src/app.js`：
```js
import { I18n, loadLocales, detectInitialLocale } from "./modules/i18n.js";

let i18n;

document.addEventListener("DOMContentLoaded", async () => {
  const locales = await loadLocales();
  const initial = detectInitialLocale();
  i18n = new I18n(locales, "en");
  i18n.setLocale(initial);
  i18n.applyToDOM();
  i18n.onChange(() => i18n.applyToDOM());

  window.__app.i18n = i18n;

  // ... rest of init
});

// 暴露给其它模块
export function getI18n() { return i18n; }
```

- [ ] **Step 6：dev 测：根据系统语言自动切换；浏览器开发者工具 `__app.i18n.setLocale("ja")` 看菜单变日文**

- [ ] **Step 7：commit**

```bash
git add src/modules/i18n.js tests/i18n.test.js src/app.js
git commit -m "feat: i18n with 5 locales and runtime switching"
```

### Task 5.3：语言切换 UI

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1：在 app.js 给 lang-picker 按钮加点击行为（弹下拉菜单）**

```js
function setupLangPicker() {
  const picker = document.getElementById("lang-picker");
  const label = document.getElementById("lang-label");

  function updateLabel() {
    const names = { "zh-CN": "中文", "zh-TW": "繁中", "en": "EN", "ja": "日本語", "ko": "한국어" };
    label.textContent = names[i18n.currentLocale] || i18n.currentLocale;
  }
  updateLabel();
  i18n.onChange(updateLabel);

  picker.addEventListener("click", (e) => {
    e.stopPropagation();
    const existing = document.querySelector(".lang-dropdown");
    if (existing) { existing.remove(); return; }
    const dropdown = document.createElement("div");
    dropdown.className = "lang-dropdown";
    const opts = [
      ["zh-CN", "简体中文"],
      ["zh-TW", "繁體中文"],
      ["en", "English"],
      ["ja", "日本語"],
      ["ko", "한국어"]
    ];
    opts.forEach(([code, name]) => {
      const item = document.createElement("button");
      item.className = "lang-option";
      item.textContent = name;
      if (code === i18n.currentLocale) item.classList.add("active");
      item.addEventListener("click", () => {
        i18n.setLocale(code);
        localStorage.setItem("md-reader.locale", code);
        dropdown.remove();
      });
      dropdown.appendChild(item);
    });
    document.body.appendChild(dropdown);
    const rect = picker.getBoundingClientRect();
    dropdown.style.position = "absolute";
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".lang-dropdown").forEach(d => d.remove());
  });
}
```

- [ ] **Step 2：在 layout.css 添加下拉样式**

`src/styles/layout.css` 末尾追加：
```css
.lang-dropdown {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 4px;
  z-index: 1000;
  min-width: 140px;
}
.lang-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  background: none;
  border: none;
  cursor: pointer;
}
.lang-option:hover { background: var(--bg-hover); }
.lang-option.active { background: var(--bg-active); font-weight: 600; }
```

- [ ] **Step 3：app.js 在 init 后调用 setupLangPicker**

- [ ] **Step 4：dev 测：点 🌐 出现下拉，选语言菜单实时变化**

- [ ] **Step 5：commit**

```bash
git add src/app.js src/styles/layout.css
git commit -m "feat: language picker dropdown"
```

---

## Phase 6：菜单 / 快捷键 / 状态栏 / 查找

### Task 6.1：menu.js（顶部菜单下拉）

**Files:**
- Create: `src/modules/menu.js`
- Modify: `src/styles/layout.css`
- Modify: `src/app.js`

- [ ] **Step 1：写 menu.js**

`src/modules/menu.js`:
```js
// Menu definition: tree of items per top-level menu
export function buildMenuConfig(i18n, actions) {
  return {
    file: [
      { i18n: "menu.file.open", shortcut: "Ctrl+O", action: actions.open },
      { i18n: "menu.file.save", shortcut: "Ctrl+S", action: actions.save },
      { i18n: "menu.file.save_as", shortcut: "Ctrl+Shift+S", action: actions.saveAs },
      { type: "separator" },
      { i18n: "menu.file.print", shortcut: "Ctrl+P", action: actions.print },
      { type: "separator" },
      { i18n: "menu.file.set_default", action: actions.setDefault },
      { type: "separator" },
      { i18n: "menu.file.close", shortcut: "Ctrl+W", action: actions.close }
    ],
    edit: [
      { i18n: "menu.edit.undo", shortcut: "Ctrl+Z", action: actions.undo },
      { i18n: "menu.edit.redo", shortcut: "Ctrl+Y", action: actions.redo },
      { type: "separator" },
      { i18n: "menu.edit.cut", shortcut: "Ctrl+X", action: actions.cut },
      { i18n: "menu.edit.copy", shortcut: "Ctrl+C", action: actions.copy },
      { i18n: "menu.edit.paste", shortcut: "Ctrl+V", action: actions.paste },
      { i18n: "menu.edit.select_all", shortcut: "Ctrl+A", action: actions.selectAll },
      { type: "separator" },
      { i18n: "menu.edit.find", shortcut: "Ctrl+F", action: actions.find }
    ],
    view: [
      { i18n: "menu.view.read", shortcut: "Ctrl+E", action: () => actions.setMode("read") },
      { i18n: "menu.view.edit", shortcut: "Ctrl+E", action: () => actions.setMode("edit") },
      { type: "separator" },
      { i18n: "menu.view.toc", shortcut: "Ctrl+\\", action: actions.toggleTOC },
      { type: "separator" },
      { i18n: "menu.view.theme_light", action: () => actions.setTheme("light") },
      { i18n: "menu.view.theme_dark", action: () => actions.setTheme("dark") },
      { i18n: "menu.view.theme_auto", action: () => actions.setTheme("auto") },
      { type: "separator" },
      { i18n: "menu.view.zoom_in", shortcut: "Ctrl++", action: actions.zoomIn },
      { i18n: "menu.view.zoom_out", shortcut: "Ctrl+-", action: actions.zoomOut },
      { i18n: "menu.view.zoom_reset", shortcut: "Ctrl+0", action: actions.zoomReset }
    ],
    help: [
      { i18n: "menu.help.usage", shortcut: "F1", action: actions.showHelp },
      { type: "separator" },
      { i18n: "menu.help.mermaid", action: actions.toggleMermaid, checkable: true, isChecked: () => actions.isMermaidEnabled?.() },
      { i18n: "menu.help.katex", action: actions.toggleKatex, checkable: true, isChecked: () => actions.isKatexEnabled?.() },
      { type: "separator" },
      { i18n: "menu.help.language", action: actions.showLangPicker },
      { type: "separator" },
      { i18n: "menu.help.about", action: actions.showAbout }
    ]
  };
}

export function setupMenus(i18n, actions) {
  const menus = buildMenuConfig(i18n, actions);
  const buttons = document.querySelectorAll(".menubar .menu-item[data-menu]");

  function closeAll() {
    document.querySelectorAll(".menu-dropdown").forEach(d => d.remove());
    buttons.forEach(b => b.classList.remove("open"));
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menuKey = btn.dataset.menu;
      const wasOpen = btn.classList.contains("open");
      closeAll();
      if (wasOpen) return;

      btn.classList.add("open");
      const items = menus[menuKey];
      const dropdown = document.createElement("div");
      dropdown.className = "menu-dropdown";

      items.forEach(item => {
        if (item.type === "separator") {
          const sep = document.createElement("div");
          sep.className = "menu-separator";
          dropdown.appendChild(sep);
          return;
        }
        const row = document.createElement("button");
        row.className = "menu-row";
        const label = document.createElement("span");
        label.className = "menu-row-label";
        label.textContent = i18n.t(item.i18n);
        if (item.checkable && item.isChecked?.()) {
          label.textContent = "✓ " + label.textContent;
        }
        row.appendChild(label);

        if (item.shortcut) {
          const sc = document.createElement("span");
          sc.className = "menu-row-shortcut";
          sc.textContent = item.shortcut;
          row.appendChild(sc);
        }
        row.addEventListener("click", () => {
          closeAll();
          item.action?.();
        });
        dropdown.appendChild(row);
      });

      document.body.appendChild(dropdown);
      const rect = btn.getBoundingClientRect();
      dropdown.style.position = "absolute";
      dropdown.style.top = `${rect.bottom}px`;
      dropdown.style.left = `${rect.left}px`;
    });
  });

  document.addEventListener("click", closeAll);
}
```

- [ ] **Step 2：layout.css 加菜单下拉样式**

```css
.menu-dropdown {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 4px;
  z-index: 1000;
  min-width: 220px;
}
.menu-row {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.menu-row:hover { background: var(--bg-hover); }
.menu-row-label { flex: 1; }
.menu-row-shortcut {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-left: 24px;
  font-family: "JetBrains Mono", monospace;
}
.menu-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.menu-item.open { background: var(--bg-hover); }
```

- [ ] **Step 3：app.js 接通 setupMenus**

```js
import { setupMenus } from "./modules/menu.js";

const actions = {
  open: () => fileOps.open(),
  save: () => fileOps.save(),
  saveAs: () => fileOps.saveAs(),
  print: () => window.print(),
  setDefault: () => fileOps.setAsDefaultMd(),
  close: () => window.close(),

  undo: () => document.execCommand("undo"),
  redo: () => document.execCommand("redo"),
  cut: () => document.execCommand("cut"),
  copy: () => document.execCommand("copy"),
  paste: () => document.execCommand("paste"),
  selectAll: () => document.execCommand("selectAll"),
  find: () => search.open(),

  setMode: (mode) => switchMode(mode),
  toggleTOC: () => {
    const app = document.getElementById("app");
    app.dataset.sidebar = app.dataset.sidebar === "hidden" ? "" : "hidden";
  },
  setTheme: (t) => theme.set(t),
  zoomIn: () => zoom.delta(+1),
  zoomOut: () => zoom.delta(-1),
  zoomReset: () => zoom.reset(),
  showHelp: () => helpDialog.show(),
  toggleMermaid: () => plugins.toggleMermaid(),
  toggleKatex: () => plugins.toggleKatex(),
  isMermaidEnabled: () => plugins.isMermaidEnabled(),
  isKatexEnabled: () => plugins.isKatexEnabled(),
  showLangPicker: () => document.getElementById("lang-picker").click(),
  showAbout: () => aboutDialog.show()
};

setupMenus(i18n, actions);
```

> 注：`fileOps`、`search`、`theme`、`zoom`、`helpDialog`、`plugins`、`aboutDialog` 在后续 task 实现。先写 placeholder：
```js
const fileOps = { open: () => alert("TODO"), save: () => alert("TODO"), saveAs: () => alert("TODO"), setAsDefaultMd: () => alert("TODO") };
const search = { open: () => alert("TODO") };
const theme = { set: (t) => alert(`theme: ${t}`) };
const zoom = { delta: () => {}, reset: () => {} };
const helpDialog = { show: () => alert("TODO") };
const plugins = { toggleMermaid: () => {}, toggleKatex: () => {}, isMermaidEnabled: () => false, isKatexEnabled: () => false };
const aboutDialog = { show: () => alert("TODO") };
```

- [ ] **Step 4：dev 测：4 个菜单都能展开，子项点击触发 alert**

- [ ] **Step 5：commit**

```bash
git add src/modules/menu.js src/styles/layout.css src/app.js
git commit -m "feat: top menu with dropdowns and i18n labels"
```

### Task 6.2：shortcuts.js

**Files:**
- Create: `src/modules/shortcuts.js`
- Modify: `src/app.js`

- [ ] **Step 1：写 shortcuts.js**

`src/modules/shortcuts.js`:
```js
// Map keyboard event → action key
const KEY_MAP = [
  { keys: "Ctrl+O", action: "open" },
  { keys: "Ctrl+S", action: "save" },
  { keys: "Ctrl+Shift+S", action: "saveAs" },
  { keys: "Ctrl+P", action: "print" },
  { keys: "Ctrl+W", action: "close" },
  { keys: "Ctrl+E", action: "toggleMode" },
  { keys: "Ctrl+\\", action: "toggleTOC" },
  { keys: "Ctrl+F", action: "find" },
  { keys: "Ctrl+=", action: "zoomIn" },
  { keys: "Ctrl++", action: "zoomIn" },
  { keys: "Ctrl+-", action: "zoomOut" },
  { keys: "Ctrl+0", action: "zoomReset" },
  { keys: "F1", action: "showHelp" },
  { keys: "F11", action: "fullscreen" }
];

function eventToKey(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let k = e.key;
  if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join("+");
}

export function setupShortcuts(actions) {
  document.addEventListener("keydown", (e) => {
    const key = eventToKey(e);
    const match = KEY_MAP.find(m => m.keys === key);
    if (match && actions[match.action]) {
      e.preventDefault();
      actions[match.action]();
    }
  });
}
```

- [ ] **Step 2：app.js 引入并调用**

```js
import { setupShortcuts } from "./modules/shortcuts.js";

setupShortcuts({
  ...actions,
  toggleMode: () => switchMode(state.mode === "read" ? "edit" : "read"),
  fullscreen: () => document.documentElement.requestFullscreen?.()
});
```

- [ ] **Step 3：dev 测各快捷键**

- [ ] **Step 4：commit**

```bash
git add src/modules/shortcuts.js src/app.js
git commit -m "feat: global keyboard shortcuts"
```

### Task 6.3：statusbar.js

**Files:**
- Create: `src/modules/statusbar.js`
- Modify: `src/app.js`

- [ ] **Step 1：写 statusbar.js**

`src/modules/statusbar.js`:
```js
export class StatusBar {
  constructor(i18n) {
    this.i18n = i18n;
    this.elements = {
      path: document.getElementById("status-path"),
      encoding: document.getElementById("status-encoding"),
      stats: document.getElementById("status-stats"),
      mode: document.getElementById("status-mode")
    };
  }

  setPath(path) {
    if (path) {
      this.elements.path.textContent = `📄 ${path}`;
      this.elements.path.title = path;
    } else {
      this.elements.path.textContent = this.i18n.t("status.no_file");
    }
  }

  setEncoding(encoding) {
    this.elements.encoding.textContent = encoding || "UTF-8";
  }

  setStats(text) {
    const chars = text ? text.length : 0;
    this.elements.stats.textContent = this.i18n.t("status.chars", { n: chars.toLocaleString() });
  }

  setMode(mode) {
    const key = mode === "edit" ? "status.edit_mode" : "status.read_mode";
    this.elements.mode.dataset.i18n = key;
    this.elements.mode.textContent = this.i18n.t(key);
  }

  setDirty(isDirty) {
    const baseKey = this.elements.mode.dataset.i18n;
    let text = this.i18n.t(baseKey);
    if (isDirty) text += "  " + this.i18n.t("status.dirty");
    this.elements.mode.textContent = text;
  }
}
```

- [ ] **Step 2：app.js 接通**

```js
import { StatusBar } from "./modules/statusbar.js";

const statusBar = new StatusBar(i18n);
statusBar.setPath(state.filePath);
statusBar.setEncoding("UTF-8");
statusBar.setStats(state.rawText);
statusBar.setMode(state.mode);

i18n.onChange(() => {
  statusBar.setPath(state.filePath);
  statusBar.setMode(state.mode);
  statusBar.setStats(state.rawText);
});
```

- [ ] **Step 3：commit**

```bash
git add src/modules/statusbar.js src/app.js
git commit -m "feat: status bar with i18n updates"
```

### Task 6.4：search.js（Ctrl+F 浮窗）

**Files:**
- Create: `src/modules/search.js`
- Modify: `src/styles/layout.css`
- Modify: `src/app.js`

- [ ] **Step 1：写 search.js**

`src/modules/search.js`:
```js
export class Search {
  constructor(i18n) {
    this.i18n = i18n;
    this.overlay = null;
    this.matches = [];
    this.current = -1;
  }

  open() {
    if (this.overlay) {
      this.overlay.querySelector("input").focus();
      return;
    }
    this.overlay = document.createElement("div");
    this.overlay.className = "search-overlay";
    this.overlay.innerHTML = `
      <input type="text" class="search-input" placeholder="${this.i18n.t("search.placeholder")}" />
      <span class="search-count"></span>
      <button class="search-prev">↑</button>
      <button class="search-next">↓</button>
      <button class="search-close">✕</button>
    `;
    document.body.appendChild(this.overlay);
    const input = this.overlay.querySelector(".search-input");
    input.focus();

    input.addEventListener("input", () => this.find(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.next();
      if (e.key === "Escape") this.close();
    });
    this.overlay.querySelector(".search-prev").addEventListener("click", () => this.prev());
    this.overlay.querySelector(".search-next").addEventListener("click", () => this.next());
    this.overlay.querySelector(".search-close").addEventListener("click", () => this.close());
  }

  find(query) {
    this.clearHighlights();
    this.matches = [];
    this.current = -1;
    if (!query || query.length < 1) {
      this.updateCount();
      return;
    }

    const root = document.getElementById("renderer-output");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

    while ((node = walker.nextNode())) {
      const text = node.nodeValue;
      const parent = node.parentElement;
      if (!parent || parent.classList.contains("search-highlight")) continue;
      let match;
      const ranges = [];
      while ((match = re.exec(text)) !== null) {
        ranges.push([match.index, match.index + match[0].length]);
      }
      if (ranges.length === 0) continue;

      // Replace text node with highlighted spans
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      ranges.forEach(([s, e]) => {
        if (s > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, s)));
        const span = document.createElement("span");
        span.className = "search-highlight";
        span.textContent = text.slice(s, e);
        frag.appendChild(span);
        this.matches.push(span);
        lastIdx = e;
      });
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      parent.replaceChild(frag, node);
    }

    if (this.matches.length > 0) {
      this.current = 0;
      this.scrollToCurrent();
    }
    this.updateCount();
  }

  next() {
    if (this.matches.length === 0) return;
    this.current = (this.current + 1) % this.matches.length;
    this.scrollToCurrent();
    this.updateCount();
  }

  prev() {
    if (this.matches.length === 0) return;
    this.current = (this.current - 1 + this.matches.length) % this.matches.length;
    this.scrollToCurrent();
    this.updateCount();
  }

  scrollToCurrent() {
    this.matches.forEach(m => m.classList.remove("active"));
    const el = this.matches[this.current];
    el.classList.add("active");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  updateCount() {
    const count = this.overlay?.querySelector(".search-count");
    if (!count) return;
    if (this.matches.length === 0) {
      count.textContent = this.i18n.t("search.no_results");
    } else {
      count.textContent = this.i18n.t("search.results", {
        current: this.current + 1,
        total: this.matches.length
      });
    }
  }

  clearHighlights() {
    document.querySelectorAll(".search-highlight").forEach(span => {
      const text = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(text, span);
    });
    // Normalize to merge adjacent text nodes
    const root = document.getElementById("renderer-output");
    if (root) root.normalize();
  }

  close() {
    this.clearHighlights();
    this.overlay?.remove();
    this.overlay = null;
    this.matches = [];
    this.current = -1;
  }
}
```

- [ ] **Step 2：layout.css 加搜索 UI 样式**

```css
.search-overlay {
  position: fixed;
  top: 70px;
  right: 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 999;
}
.search-input {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  width: 200px;
}
.search-input:focus { border-color: var(--accent); }
.search-count {
  font-size: 12px;
  color: var(--text-tertiary);
  min-width: 50px;
}
.search-overlay button {
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  border-radius: 4px;
}
.search-overlay button:hover { background: var(--bg-hover); }
.search-highlight {
  background: yellow;
  color: black;
}
.search-highlight.active {
  background: orange;
}
html[data-theme="dark"] .search-highlight {
  background: #4d4500;
  color: #fff;
}
html[data-theme="dark"] .search-highlight.active {
  background: #b07000;
}
```

- [ ] **Step 3：app.js 替换 search placeholder**

```js
import { Search } from "./modules/search.js";
const search = new Search(i18n);
```

- [ ] **Step 4：dev 测 Ctrl+F 工作**

- [ ] **Step 5：commit**

```bash
git add src/modules/search.js src/styles/layout.css src/app.js
git commit -m "feat: in-document search with highlight and navigation"
```

---

## Phase 7：文件操作 + 编码

### Task 7.1：Tauri Rust commands

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1：Cargo.toml 加依赖**

`src-tauri/Cargo.toml` 在 `[dependencies]` 加：
```toml
encoding_rs = "0.8"
chardetng = "0.1"
```

- [ ] **Step 2：写 commands.rs**

`src-tauri/src/commands.rs`:
```rust
use std::fs;
use std::path::Path;
use serde::Serialize;
use encoding_rs::{Encoding, UTF_8, GBK};

#[derive(Serialize)]
pub struct FileResult {
    pub content: String,
    pub encoding: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<FileResult, String> {
    let bytes = fs::read(&path).map_err(|e| format!("read failed: {}", e))?;
    let size_bytes = bytes.len() as u64;

    // Try UTF-8 first
    let (content, encoding) = decode_with_fallback(&bytes);

    Ok(FileResult { content, encoding, size_bytes })
}

fn decode_with_fallback(bytes: &[u8]) -> (String, String) {
    // 1. Strict UTF-8
    if let Ok(s) = std::str::from_utf8(bytes) {
        return (s.to_string(), "UTF-8".to_string());
    }
    // 2. Detector (chardetng) for non-UTF8
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let enc = detector.guess(None, true);
    let (decoded, _, had_errors) = enc.decode(bytes);
    if !had_errors {
        return (decoded.into_owned(), enc.name().to_string());
    }
    // 3. Force GBK as last resort (common for Chinese Windows)
    let (decoded, _, _) = GBK.decode(bytes);
    (decoded.into_owned(), "GBK".to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("write failed: {}", e))
}

#[tauri::command]
pub fn file_size(path: String) -> Result<u64, String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(meta.len())
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}
```

- [ ] **Step 3：main.rs 注册 commands**

`src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
use commands::{read_file, write_file, file_size, file_exists};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_file, write_file, file_size, file_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4：装 tauri 插件**

```bash
cd src-tauri
cargo add tauri-plugin-dialog tauri-plugin-shell tauri-plugin-fs
cd ..
pnpm add @tauri-apps/plugin-dialog @tauri-apps/plugin-shell @tauri-apps/plugin-fs
```

- [ ] **Step 5：编译验证**

```bash
pnpm tauri dev
```

- [ ] **Step 6：commit**

```bash
git add src-tauri/
git commit -m "feat: Tauri rust commands for file IO with encoding detection"
```

### Task 7.2：fileOps.js（前端文件操作）

**Files:**
- Create: `src/modules/fileOps.js`
- Modify: `src/app.js`

- [ ] **Step 1：写 fileOps.js**

`src/modules/fileOps.js`:
```js
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog, message, ask } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const SIZE_THRESHOLD_WARN = 5 * 1024 * 1024;   // 5MB
const SIZE_THRESHOLD_REJECT = 20 * 1024 * 1024; // 20MB
const RECENT_KEY = "md-reader.recent";
const RECENT_MAX = 10;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export class FileOps {
  constructor({ i18n, onLoaded, onSaved, getDirty, getCurrent }) {
    this.i18n = i18n;
    this.onLoaded = onLoaded;
    this.onSaved = onSaved;
    this.getDirty = getDirty;
    this.getCurrent = getCurrent;
  }

  async confirmDiscard() {
    if (!this.getDirty()) return true;
    const result = await ask(
      this.i18n.t("dialog.unsaved.body", { file: this.getCurrent().filePath || "" }),
      { title: this.i18n.t("dialog.unsaved.title"), kind: "warning" }
    );
    return result;
  }

  async open(path) {
    if (!await this.confirmDiscard()) return;

    if (!path) {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }]
      });
      if (!selected) return;
      path = selected;
    }

    const size = await invoke("file_size", { path });
    if (size > SIZE_THRESHOLD_REJECT) {
      await message(
        this.i18n.t("dialog.too_large.body", { size: formatSize(size) }),
        { title: this.i18n.t("dialog.too_large.title"), kind: "error" }
      );
      return;
    }
    if (size > SIZE_THRESHOLD_WARN) {
      const ok = await ask(
        this.i18n.t("dialog.large_file.body", { size: formatSize(size) }),
        { title: this.i18n.t("dialog.large_file.title") }
      );
      if (!ok) return;
    }

    const result = await invoke("read_file", { path });
    this.onLoaded({ path, content: result.content, encoding: result.encoding });
    this.addRecent(path);
  }

  async save() {
    const cur = this.getCurrent();
    if (!cur.filePath) return this.saveAs();
    await invoke("write_file", { path: cur.filePath, content: cur.rawText });
    this.onSaved();
  }

  async saveAs() {
    const cur = this.getCurrent();
    const path = await saveDialog({
      defaultPath: cur.filePath || "untitled.md",
      filters: [{ name: "Markdown", extensions: ["md"] }]
    });
    if (!path) return;
    await invoke("write_file", { path, content: cur.rawText });
    this.onSaved(path);
    this.addRecent(path);
  }

  addRecent(path) {
    const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const filtered = recent.filter(p => p !== path);
    filtered.unshift(path);
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, RECENT_MAX)));
  }

  getRecent() {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  }

  setupDragDrop() {
    const win = getCurrentWebviewWindow();
    win.onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          const md = paths.find(p => /\.(md|markdown|mdown)$/i.test(p));
          if (md) this.open(md);
        }
      }
    });
  }

  // Read CLI args for double-click open
  async setupCliArgs() {
    // Tauri 2 exposes args via invoke
    try {
      const args = await invoke("get_cli_args").catch(() => []);
      const path = args.find(a => /\.(md|markdown|mdown)$/i.test(a));
      if (path) await this.open(path);
    } catch (_) { /* ignore */ }
  }
}
```

- [ ] **Step 2：在 main.rs 加 get_cli_args 命令**

`src-tauri/src/commands.rs` 末尾追加：
```rust
#[tauri::command]
pub fn get_cli_args() -> Vec<String> {
    std::env::args().skip(1).collect()
}
```

`src-tauri/src/main.rs` 把 `get_cli_args` 加到 invoke_handler！

- [ ] **Step 3：app.js 接通 fileOps**

```js
import { FileOps } from "./modules/fileOps.js";

const fileOps = new FileOps({
  i18n,
  onLoaded: ({ path, content, encoding }) => {
    state.filePath = path;
    state.rawText = content;
    statusBar.setPath(path);
    statusBar.setEncoding(encoding);
    statusBar.setStats(content);
    rerender();
    if (state.mode === "edit") setEditorText(content);
    document.getElementById("window-title").textContent = `${path.split(/[\\/]/).pop()} — Markdown Reader`;
  },
  onSaved: (newPath) => {
    if (newPath) state.filePath = newPath;
    editor.clearDirty();
    statusBar.setDirty(false);
  },
  getDirty: () => editor.isDirty(),
  getCurrent: () => state
});

fileOps.setupDragDrop();
fileOps.setupCliArgs();
```

- [ ] **Step 4：dev 测：菜单 文件→打开 + 拖入 .md + Ctrl+S 都正常**

- [ ] **Step 5：commit**

```bash
git add src-tauri/ src/modules/fileOps.js src/app.js
git commit -m "feat: file operations (open/save/dialogs/drag-drop/CLI args)"
```

### Task 7.3：编辑模式下复制 / 粘贴 / 撤销正确路由

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1：在 actions 里区分 read / edit 模式的复制粘贴**

```js
const actions = {
  // ...
  copy: () => {
    if (state.mode === "edit") {
      document.execCommand("copy");
    } else {
      const sel = window.getSelection().toString();
      if (sel) navigator.clipboard.writeText(sel);
    }
  },
  paste: () => {
    if (state.mode === "edit") document.execCommand("paste");
    // read mode: paste is no-op
  },
  cut: () => {
    if (state.mode === "edit") document.execCommand("cut");
  },
  undo: () => {
    if (state.mode === "edit") document.execCommand("undo");
  },
  redo: () => {
    if (state.mode === "edit") document.execCommand("redo");
  },
  selectAll: () => {
    if (state.mode === "edit") {
      document.getElementById("editor-input").select();
    } else {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("renderer-output"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
};
```

- [ ] **Step 2：dev 测：read 模式 Ctrl+C 复制纯文本；edit 模式全套快捷键工作**

- [ ] **Step 3：commit**

```bash
git add src/app.js
git commit -m "feat: mode-aware clipboard and undo routing"
```

---

## Phase 8：插件（Mermaid + KaTeX）

### Task 8.1：plugin loader + Mermaid

**Files:**
- Create: `src/modules/plugins/mermaid.js`
- Modify: `src/modules/renderer.js`
- Modify: `package.json`
- Modify: `src/app.js`

- [ ] **Step 1：装 mermaid**

```bash
pnpm add mermaid
```

- [ ] **Step 2：写 mermaid.js**

`src/modules/plugins/mermaid.js`:
```js
let mermaidLib = null;
let enabled = false;

const KEY = "md-reader.plugin.mermaid";

export function isEnabled() {
  if (enabled) return true;
  return localStorage.getItem(KEY) === "1";
}

export async function setEnabled(value) {
  enabled = value;
  localStorage.setItem(KEY, value ? "1" : "0");
  if (value && !mermaidLib) {
    const mod = await import("mermaid");
    mermaidLib = mod.default;
    mermaidLib.initialize({
      startOnLoad: false,
      theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
      securityLevel: "strict"
    });
  }
}

export async function processMermaidBlocks(rootEl) {
  if (!isEnabled() || !mermaidLib) return;
  const blocks = rootEl.querySelectorAll("pre code.language-mermaid");
  for (let i = 0; i < blocks.length; i++) {
    const code = blocks[i];
    const pre = code.parentElement;
    const src = code.textContent;
    const id = `mermaid-${Date.now()}-${i}`;
    try {
      const { svg } = await mermaidLib.render(id, src);
      const wrap = document.createElement("div");
      wrap.className = "mermaid-block";
      wrap.innerHTML = svg;
      pre.replaceWith(wrap);
    } catch (err) {
      pre.classList.add("mermaid-error");
      pre.title = `Mermaid render error: ${err.message}`;
    }
  }
}
```

- [ ] **Step 3：rerender 后调用 processMermaidBlocks**

`src/app.js` 改 rerender：
```js
import * as mermaidPlugin from "./modules/plugins/mermaid.js";
// ...

async function rerender() {
  const html = renderMarkdown(state.rawText);
  const output = document.getElementById("renderer-output");
  output.innerHTML = html;

  await mermaidPlugin.processMermaidBlocks(output);

  const toc = extractTOC(html);
  renderTOC(toc, document.getElementById("toc"));
}

// init plugins from saved state
mermaidPlugin.setEnabled(mermaidPlugin.isEnabled());
```

更新 actions：
```js
const plugins = {
  toggleMermaid: async () => {
    await mermaidPlugin.setEnabled(!mermaidPlugin.isEnabled());
    rerender();
  },
  isMermaidEnabled: () => mermaidPlugin.isEnabled(),
  // katex below
};
```

- [ ] **Step 4：测试一份带 \`\`\`mermaid 的 .md：开关启用前是代码块；启用后变流程图**

- [ ] **Step 5：commit**

```bash
git add src/modules/plugins/mermaid.js src/app.js package.json
git commit -m "feat: optional Mermaid plugin (lazy-loaded)"
```

### Task 8.2：KaTeX plugin

**Files:**
- Create: `src/modules/plugins/katex.js`
- Modify: `src/app.js`
- Modify: `package.json`

- [ ] **Step 1：装 katex**

```bash
pnpm add katex
```

- [ ] **Step 2：写 katex.js**

`src/modules/plugins/katex.js`:
```js
let katexLib = null;
let enabled = false;

const KEY = "md-reader.plugin.katex";

export function isEnabled() {
  if (enabled) return true;
  return localStorage.getItem(KEY) === "1";
}

export async function setEnabled(value) {
  enabled = value;
  localStorage.setItem(KEY, value ? "1" : "0");
  if (value && !katexLib) {
    const mod = await import("katex");
    katexLib = mod.default;
    // Inject katex CSS
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href = new URL("../../node_modules/katex/dist/katex.min.css", import.meta.url).href;
      document.head.appendChild(link);
    }
  }
}

export function processKatexBlocks(rootEl) {
  if (!isEnabled() || !katexLib) return;

  // Walk text nodes, replace $...$ and $$...$$
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach(node => {
    const parent = node.parentElement;
    if (!parent) return;
    if (parent.closest("pre, code, .katex")) return;
    const text = node.nodeValue;
    if (!text.includes("$")) return;

    const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
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
        katexLib.render(expr, span, { displayMode: isDisplay, throwOnError: false });
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
```

- [ ] **Step 3：app.js 接入**

```js
import * as katexPlugin from "./modules/plugins/katex.js";

async function rerender() {
  const html = renderMarkdown(state.rawText);
  const output = document.getElementById("renderer-output");
  output.innerHTML = html;
  await mermaidPlugin.processMermaidBlocks(output);
  katexPlugin.processKatexBlocks(output);
  const toc = extractTOC(html);
  renderTOC(toc, document.getElementById("toc"));
}

katexPlugin.setEnabled(katexPlugin.isEnabled());

plugins.toggleKatex = async () => {
  await katexPlugin.setEnabled(!katexPlugin.isEnabled());
  rerender();
};
plugins.isKatexEnabled = () => katexPlugin.isEnabled();
```

- [ ] **Step 4：测试一份带 `$E=mc^2$` 的 .md**

- [ ] **Step 5：commit**

```bash
git add src/modules/plugins/katex.js src/app.js package.json
git commit -m "feat: optional KaTeX plugin (lazy-loaded)"
```

---

## Phase 9：主题（浅 / 深 / 跟随系统）

### Task 9.1：theme.js

**Files:**
- Create: `src/modules/theme.js`
- Modify: `src/app.js`

- [ ] **Step 1：写 theme.js**

`src/modules/theme.js`:
```js
const KEY = "md-reader.theme";  // "light" | "dark" | "auto"

export class Theme {
  constructor() {
    this.mode = localStorage.getItem(KEY) || "auto";
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", () => {
      if (this.mode === "auto") this.apply();
    });
    this.apply();
  }

  set(mode) {
    this.mode = mode;
    localStorage.setItem(KEY, mode);
    this.apply();
  }

  apply() {
    const effective = this.mode === "auto"
      ? (this.mediaQuery.matches ? "dark" : "light")
      : this.mode;
    document.documentElement.dataset.theme = effective;
    // Toggle highlight.js stylesheets
    document.getElementById("hljs-light").disabled = effective === "dark";
    document.getElementById("hljs-dark").disabled = effective === "light";
  }
}
```

- [ ] **Step 2：app.js 接入**

```js
import { Theme } from "./modules/theme.js";
const theme = new Theme();

// In actions object, replace:
setTheme: (t) => theme.set(t),
```

也要把 toolbar 的 🌗 按钮接通：
```js
document.getElementById("theme-toggle").addEventListener("click", () => {
  const next = theme.mode === "light" ? "dark" : theme.mode === "dark" ? "auto" : "light";
  theme.set(next);
});
```

- [ ] **Step 3：dev 测：点 🌗 三态切换；菜单 视图 → 浅/深/跟随系统 也工作**

- [ ] **Step 4：commit**

```bash
git add src/modules/theme.js src/app.js
git commit -m "feat: theme switching with light/dark/auto modes"
```

### Task 9.2：欢迎屏 + 关于对话框 + 帮助

**Files:**
- Create: `src/modules/welcomeScreen.js`
- Create: `src/modules/aboutDialog.js`
- Create: `src/modules/helpDialog.js`
- Modify: `src/app.js`

- [ ] **Step 1：写 welcomeScreen.js**

`src/modules/welcomeScreen.js`:
```js
export function renderWelcome(i18n, recentFiles, onPickRecent) {
  const html = `
    <div class="welcome">
      <h1>${i18n.t("welcome.title")}</h1>
      <p class="welcome-hint">${i18n.t("welcome.hint")}</p>
      ${recentFiles.length > 0 ? `
        <h3>${i18n.t("welcome.recent")}</h3>
        <ul class="welcome-recent">
          ${recentFiles.map(p => `<li data-path="${p}">${p.split(/[\\/]/).pop()}<br><small>${p}</small></li>`).join("")}
        </ul>
      ` : ""}
    </div>
  `;
  const output = document.getElementById("renderer-output");
  output.innerHTML = html;
  output.querySelectorAll(".welcome-recent li").forEach(li => {
    li.addEventListener("click", () => onPickRecent(li.dataset.path));
  });
}
```

加样式 `src/styles/markdown.css`:
```css
.welcome {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-primary);
}
.welcome h1 { font-size: 32px; margin-bottom: 12px; }
.welcome-hint { color: var(--text-secondary); margin-bottom: 40px; font-size: 15px; }
.welcome h3 { font-size: 14px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.welcome-recent {
  list-style: none;
  padding: 0;
  max-width: 500px;
  margin: 0 auto;
}
.welcome-recent li {
  padding: 12px 16px;
  background: var(--bg-sidebar);
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
}
.welcome-recent li:hover { background: var(--bg-hover); }
.welcome-recent li small {
  color: var(--text-tertiary);
  font-size: 11px;
}
```

- [ ] **Step 2：写 aboutDialog.js**

`src/modules/aboutDialog.js`:
```js
export class AboutDialog {
  constructor(i18n) { this.i18n = i18n; }
  show() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <h2>${this.i18n.t("about.title")}</h2>
        <p>${this.i18n.t("about.version", { version: "1.0.0" })}</p>
        <p>${this.i18n.t("about.tagline")}</p>
        <button class="modal-close">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }
}
```

- [ ] **Step 3：写 helpDialog.js（内置 .md 帮助文本）**

`src/modules/helpDialog.js`:
```js
import { renderMarkdown } from "./renderer.js";

const HELP_MD = {
  "zh-CN": `# 使用说明

## 快捷键
| 操作 | 快捷键 |
|---|---|
| 打开文件 | Ctrl+O |
| 保存 | Ctrl+S |
| 另存为 | Ctrl+Shift+S |
| 切换阅读/编辑 | Ctrl+E |
| 显示/隐藏大纲 | Ctrl+\\\\ |
| 查找 | Ctrl+F |
| 撤销 / 重做 | Ctrl+Z / Ctrl+Y |
| 复制 / 粘贴 / 剪切 | Ctrl+C / V / X |
| 全选 | Ctrl+A |
| 字号放大 / 缩小 / 重置 | Ctrl++/-/0 |
| 全屏 | F11 |
| 帮助 | F1 |

## 设为 .md 默认打开方式
菜单：文件 → 设为 .md 默认打开方式（或安装时勾选）。

## 插件
帮助菜单里可启用 Mermaid 流程图、LaTeX 数学公式。
`,
  "en": `# Help

## Shortcuts
| Action | Shortcut |
|---|---|
| Open | Ctrl+O |
| Save | Ctrl+S |
| Save As | Ctrl+Shift+S |
| Toggle Read/Edit | Ctrl+E |
| Toggle Outline | Ctrl+\\\\ |
| Find | Ctrl+F |
| Undo / Redo | Ctrl+Z / Ctrl+Y |
| Copy / Paste / Cut | Ctrl+C / V / X |
| Select All | Ctrl+A |
| Zoom In/Out/Reset | Ctrl++/-/0 |
| Fullscreen | F11 |
| Help | F1 |
`
};

export class HelpDialog {
  constructor(i18n) { this.i18n = i18n; }
  show() {
    const md = HELP_MD[this.i18n.currentLocale] || HELP_MD["en"];
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal modal-help">
        <div class="modal-content">${renderMarkdown(md)}</div>
        <button class="modal-close">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".modal-close").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }
}
```

- [ ] **Step 4：modal CSS**

`src/styles/layout.css`:
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 32px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 12px 40px rgba(0,0,0,0.2);
}
.modal h2 { margin-bottom: 16px; font-size: 20px; }
.modal p { margin-bottom: 12px; color: var(--text-secondary); }
.modal-help {
  max-width: 720px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.modal-content {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
}
.modal-close {
  padding: 8px 18px;
  background: var(--accent);
  color: var(--accent-text);
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
}
.modal-close:hover { opacity: 0.9; }
```

- [ ] **Step 5：app.js 接入**

```js
import { renderWelcome } from "./modules/welcomeScreen.js";
import { AboutDialog } from "./modules/aboutDialog.js";
import { HelpDialog } from "./modules/helpDialog.js";

const aboutDialog = new AboutDialog(i18n);
const helpDialog = new HelpDialog(i18n);

// 修改 init：如果没文件，渲染 welcome
async function rerender() {
  if (!state.filePath && state.rawText === SAMPLE_MD) {
    // 第一次启动：显示 welcome
    renderWelcome(i18n, fileOps.getRecent(), (path) => fileOps.open(path));
    return;
  }
  // ... 原有逻辑
}
```

- [ ] **Step 6：dev 测：F1 显示帮助；菜单 帮助→关于 显示对话框；空启动显示欢迎屏**

- [ ] **Step 7：commit**

```bash
git add src/modules/welcomeScreen.js src/modules/aboutDialog.js src/modules/helpDialog.js src/styles/ src/app.js
git commit -m "feat: welcome screen, about dialog, help dialog"
```

### Task 9.3：字号缩放

**Files:**
- Create: `src/modules/zoom.js`
- Modify: `src/app.js`

- [ ] **Step 1：写 zoom.js**

`src/modules/zoom.js`:
```js
const KEY = "md-reader.zoom";
const MIN = 11;
const MAX = 26;
const DEFAULT = 15.5;

export class Zoom {
  constructor() {
    this.size = parseFloat(localStorage.getItem(KEY)) || DEFAULT;
    this.apply();
  }

  delta(d) {
    this.size = Math.max(MIN, Math.min(MAX, this.size + d));
    localStorage.setItem(KEY, this.size);
    this.apply();
  }

  reset() {
    this.size = DEFAULT;
    localStorage.setItem(KEY, this.size);
    this.apply();
  }

  apply() {
    document.documentElement.style.setProperty("--md-font-size", `${this.size}px`);
  }
}
```

更新 markdown.css：
```css
#renderer-output p,
#renderer-output ul,
#renderer-output ol {
  font-size: var(--md-font-size, 15.5px);
}
```

- [ ] **Step 2：app.js 接入**

```js
import { Zoom } from "./modules/zoom.js";
const zoom = new Zoom();
// actions.zoomIn / zoomOut / zoomReset 已经声明了，正确指向
```

- [ ] **Step 3：dev 测 Ctrl++/-/0**

- [ ] **Step 4：commit**

```bash
git add src/modules/zoom.js src/styles/markdown.css src/app.js
git commit -m "feat: font zoom with persistence"
```

---

## Phase 10：打包 + 安装包 + 验收

### Task 10.1：图标资源

**Files:**
- Create: `src-tauri/icons/icon.ico`
- Create: `src-tauri/icons/icon.png`（多尺寸）

- [ ] **Step 1：用 SVG 生成图标（白底+M+纸张折角）**

`src/assets/icon.svg`:
```svg
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F1EFEC"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#37352F"/>
  <path d="M 110 90 L 360 90 L 420 150 L 420 422 L 110 422 Z" fill="url(#bg)"/>
  <path d="M 360 90 L 360 150 L 420 150" fill="none" stroke="#37352F" stroke-width="6"/>
  <text x="256" y="320" font-family="Inter, sans-serif" font-size="180" font-weight="800" fill="#37352F" text-anchor="middle">M↓</text>
</svg>
```

- [ ] **Step 2：用 tauri icon 生成多尺寸**

```bash
pnpm tauri icon src/assets/icon.svg
```
预期：自动写入 `src-tauri/icons/` 下的 ico、png（多尺寸）、icns。

- [ ] **Step 3：commit**

```bash
git add src/assets/icon.svg src-tauri/icons/
git commit -m "feat: app icon (Notion-style M↓)"
```

### Task 10.2：tauri.conf.json 完整配置

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1：写完整配置（包含文件关联、MSI 多语言、安装行为）**

`src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Markdown Reader",
  "version": "1.0.0",
  "identifier": "com.dbwen.mdreader",
  "build": {
    "frontendDist": "../src",
    "devUrl": "http://localhost:1430",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "windows": [
      {
        "title": "Markdown Reader",
        "width": 1100,
        "height": 760,
        "minWidth": 600,
        "minHeight": 400,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; font-src 'self' data:"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "category": "Productivity",
    "shortDescription": "Lightweight Markdown reader",
    "longDescription": "A simple, beautiful Markdown reader for Windows. Replace Notepad for .md files.",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "fileAssociations": [
      {
        "ext": ["md", "markdown", "mdown"],
        "name": "Markdown Document",
        "description": "Markdown Document",
        "role": "Editor"
      }
    ],
    "windows": {
      "wix": {
        "language": ["en-US", "zh-CN", "zh-TW", "ja-JP", "ko-KR"]
      },
      "nsis": {
        "displayLanguageSelector": true,
        "languages": ["English", "SimpChinese", "TradChinese", "Japanese", "Korean"],
        "installMode": "currentUser"
      }
    }
  },
  "plugins": {}
}
```

- [ ] **Step 2：commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: production tauri config (MSI + NSIS + 5-language installer + .md association)"
```

### Task 10.3：构建产品安装包

**Files:** N/A（产物）

- [ ] **Step 1：跑 release build（约 5-10 分钟）**

```bash
pnpm tauri build
```

预期：编译完成后产物在：
- `src-tauri/target/release/bundle/msi/Markdown Reader_1.0.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Markdown Reader_1.0.0_x64-setup.exe`

- [ ] **Step 2：复制安装包到便于交付的位置**

```bash
mkdir -p dist
cp "src-tauri/target/release/bundle/msi/Markdown Reader_1.0.0_x64_en-US.msi" dist/
cp "src-tauri/target/release/bundle/nsis/Markdown Reader_1.0.0_x64-setup.exe" dist/
ls -lh dist/
```

期望：两个文件，每个约 8-12 MB。

- [ ] **Step 3：把 dist/ 加进 .gitignore**

`.gitignore`:
```
dist/
```

- [ ] **Step 4：commit**

```bash
git add .gitignore
git commit -m "chore: ignore dist/ build outputs"
```

### Task 10.4：用户安装试用 + 清单

**Files:**
- Create: `02-Gadgets/md-reader/INSTALL.md`

- [ ] **Step 1：写安装/试用说明**

`INSTALL.md`:
```markdown
# Markdown Reader 安装与试用

## 安装

1. 双击 `dist/Markdown Reader_1.0.0_x64-setup.exe`（NSIS，推荐）或 `Markdown Reader_1.0.0_x64_en-US.msi`
2. 弹出 SmartScreen 警告时：点「更多信息」→「仍要运行」
3. 选择安装语言（英 / 简中 / 繁中 / 日 / 韩）
4. 安装界面勾选「✓ 设为 .md 默认打开方式」（默认勾选）
5. 安装完成后桌面 / 开始菜单 出现 "Markdown Reader" 图标

## 验收清单（请逐项打勾）

### 基础打开
- [ ] 双击 .md 文件能用本应用打开
- [ ] 桌面 / 开始菜单图标点击能启动应用
- [ ] 拖拽 .md 到窗口能加载

### 渲染
- [ ] 标题（H1-H4）大小正确
- [ ] 列表（有序 / 无序）样式正常
- [ ] 引用块有左侧竖线
- [ ] 代码块语法高亮（试 Python / JS）
- [ ] 表格边框 / 表头清晰
- [ ] 链接是蓝色 + 下划线 hover
- [ ] 图片显示正确

### 模式切换
- [ ] Ctrl+E 在阅读 / 编辑间切换
- [ ] 编辑模式下右上角按钮变 ✏️ 编辑
- [ ] 编辑后右上角出现「未保存」状态
- [ ] Ctrl+S 保存后未保存标识消失
- [ ] 切回阅读模式能看到刚才的修改

### 快捷键
- [ ] Ctrl+O 打开文件
- [ ] Ctrl+C / V / X / Z / Y / A 在编辑模式下都正常
- [ ] Ctrl+F 弹搜索浮窗
- [ ] Ctrl++/-/0 字号缩放
- [ ] F11 全屏

### i18n
- [ ] 语言下拉切换简中 / 繁中 / EN / 日 / 韩，菜单和状态栏全跟着变
- [ ] 切语言不需要重启

### 主题
- [ ] 🌗 按钮三态切换：浅 / 深 / 跟随系统
- [ ] 深色模式下代码块也是深色

### 文件关联
- [ ] 装时勾选了「设默认」→ 文件资源管理器双击 .md 自动用本应用打开
- [ ] 没勾选 → 控制面板可手动改

### 大文件保护
- [ ] 5MB+ 的 .md 文件打开时弹「文件较大」确认
- [ ] 20MB+ 文件被拒绝（弹错误对话框）

### 编码
- [ ] UTF-8 .md 正常打开
- [ ] 老的 GBK 编码 .md 也能打开（中文不乱码）

### 卸载
- [ ] 控制面板 → 程序和功能 → Markdown Reader → 卸载
- [ ] 卸载后桌面图标消失
- [ ] 卸载后 .md 文件关联恢复（再双击 .md 不会用本应用）

### 性能 / 体感
- [ ] 启动 < 3 秒
- [ ] 打开 1MB .md 几乎无延迟
- [ ] 切语言 / 切主题瞬时响应
- [ ] 不卡顿、不闪烁

## 报告问题

测试中发现的任何问题：
1. 截图 + 复现步骤
2. 反馈给开发同学
3. 修复后重新打安装包再测
```

- [ ] **Step 2：commit**

```bash
git add INSTALL.md
git commit -m "docs: install and acceptance checklist"
```

### Task 10.5：交付清单 + 路径告知

- [ ] **Step 1：列出交付物路径，告知用户安装位置**

交付物（位于 `02-Gadgets/md-reader/dist/`）：
- `Markdown Reader_1.0.0_x64-setup.exe` — NSIS 安装包（推荐，安装界面友好、5 语言）
- `Markdown Reader_1.0.0_x64_en-US.msi` — MSI 安装包（备选，企业级部署）

伴随文档：
- `02-Gadgets/md-reader/INSTALL.md` — 安装步骤 + 验收清单（用户测试用）

---

## Self-Review

> 写完后回头核对一遍：每条 spec 需求都有对应 task 吗？

| Spec 章节 | 实现 task |
|---|---|
| 2. 技术选型 | Phase 1 (Rust + Tauri scaffold) |
| 3. 目录结构 | Phase 1.2 (init), Phase 2-9 (each module) |
| 4.1-4.2 UI 整体 + token | Phase 2.1-2.4 |
| 4.3 4 个菜单 | Phase 6.1 |
| 4.4 模式切换 UX | Phase 4 |
| 4.5 状态栏 | Phase 6.3 |
| 5. i18n | Phase 5 |
| 6. 主题 | Phase 9.1 |
| 7. 文件操作 | Phase 7 |
| 8. 快捷键全表 | Phase 6.2 |
| 9. 渲染细节 | Phase 3 |
| 10. 安装与分发 | Phase 10 |
| 11. 错误处理 | 散布在 Phase 7 (file ops) + Phase 4 (mode switch) |
| 12. 测试与验收清单 | Phase 10.4 INSTALL.md |
| 14. v2 后续路线 | 不做（已归档在 spec） |

✅ 全部覆盖。
