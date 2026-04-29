# Markdown Reader · Markdown 阅读器

替代 Windows 记事本，专门为 .md 文件提供漂亮渲染 + 编辑能力的桌面应用。

> 状态：**🚧 设计中** —— 详细设计见 [`DESIGN.md`](./DESIGN.md)，UI 风格 mockup 见 [`_design-mockups/ui-styles.html`](./_design-mockups/ui-styles.html)。

## 一句话定位

**像记事本一样简单，但能漂亮渲染 .md 格式。**

## 核心功能（v1）

- 双击 .md 文件即打开（系统级文件关联）
- 默认渲染态显示（Notion 风），Ctrl+E 一键切换原始文本编辑
- 五语言界面：简中 / 英 / 日 / 韩 / 繁中
- 浅 / 深主题，跟随系统或一键切换
- 左侧大纲（TOC）自动生成
- 顶部菜单：文件 / 编辑 / 视图 / 帮助
- 标准快捷键全套（Ctrl+S / C / V / Z / F / P）
- 代码块语法高亮（Python / JS / Rust 等主流语言）
- 可选插件：Mermaid 流程图、LaTeX 数学公式

## 不做的（YAGNI）

- 实时多人协作
- 云同步
- 文件管理器（只一次打开一个文件）
- 内置 AI 写作助手
- WYSIWYG 所见即所得编辑（v1 用模式切换，体验更稳）

## 架构

- **桌面壳**：Tauri（Rust + Windows WebView2）→ 安装包 ~10MB
- **前端**：HTML + CSS + JS（Notion 风 UI）
- **渲染**：marked.js + highlight.js
- **国际化**：JSON 字符串字典 + 运行时切换

## 启动方式

**目标形态**：Windows `.msi` 安装包，桌面快捷方式，可设为 .md 默认打开方式。

| 阶段 | 怎么用 |
|---|---|
| 开发期 | `pnpm tauri dev` 在本机跑 |
| 测试期 | `pnpm tauri build` → 装 `.msi` 试用 |
| 上线 | 测试通过后上传 GitHub Releases，他人下载 .msi 双击安装 |

## 文档

- [`DESIGN.md`](./DESIGN.md) — 完整设计文档（架构 / UI 规范 / i18n / 安装 / 快捷键 / 测试）
- [`_design-mockups/ui-styles.html`](./_design-mockups/ui-styles.html) — UI 风格对比（已选 Notion 风）
