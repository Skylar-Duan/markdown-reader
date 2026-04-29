# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] — 2026-04-29

### Fixed
- **第二次双击 .md 时窗口正确弹回前台** · 之前窗口若被最小化到任务栏，再双击新文件虽然能加 Tab，但窗口不会还原。修法：单实例插件回调里 `set_focus()` 之前先 `unminimize()` + `show()`（Windows 上光 `set_focus()` 不还原最小化窗口）。
- **移除第一次启动弹的"设为默认"对话框** · 这个对话框跑的 `reg add` 在某些场景失败，且**冗余**——NSIS 安装器装的时候已经通过 `fileAssociations` 自动注册关联（安装界面那个"Set as default for .md files"勾选项就是它）。菜单里的"设为默认"手动入口保留作兜底。

## [1.2.0] — 2026-04-29

### Changed (Breaking UX)
- **多 Tab 替代多窗口** · 按用户反馈，恢复成 Win11 记事本样式：所有 .md 在**同一个窗口的 Tab 里切换**，不再各开独立窗口。
  - 顶部 Tab 栏：每个文件一个 Tab，× 关闭，+ 新建
  - 双击新 .md（或拖入 / Ctrl+O）→ 在当前窗口加新 Tab
  - **Ctrl+T** 新建 Tab，**Ctrl+W** 关闭当前 Tab，**Ctrl+Tab / Ctrl+Shift+Tab** 前后切换，也支持 **Ctrl+PgDown / Ctrl+PgUp**
  - 中键点击 Tab 关闭
  - 关闭最后一个 Tab → 关闭窗口
  - 每 Tab 独立：文件路径 / 阅读·编辑模式 / 未保存状态 / 滚动位置 / 光标
  - 全局共享：主题 / 语言 / 最近文件 / 字号 / 插件状态

### Fixed
- **Ctrl+E 切换模式 · 真正保留滚动位置** · v1.1.0 切到编辑模式时 `textarea.focus()` 会把光标位置滚进视窗，覆盖我们设的 `scrollTop`。修法：切到 edit 前先把光标位置同步到对应的滚动比例处（按行起始对齐），再 focus → focus 不再触发滚动跳转。现在不管在 read 模式滚到哪，切到 edit 都从对应位置开始编辑。

### Tech
- 新增 Tauri event `open-file-in-tab`：单实例插件捕获第 2 次启动 → emit 事件 → 前端监听 → 加 Tab（不再 WebviewWindowBuilder）
- 移除 `urlencoding` 依赖（不再走 URL hash 路径）
- Capabilities 收回到只 `main` window

## [1.1.0] — 2026-04-29

### Added
- **多窗口支持** · 双击多个 .md 文件，每个独立窗口（单实例 + 多 WebviewWindow 模式）。关闭一个不影响另一个，主题/语言/最近文件/插件状态跨窗口共享
- **新应用图标** · Notion 风文档 + 蓝色折角 + 黑色 MD 标题 + 灰色文字线（替代之前的 M↓ 设计）

### Changed
- **Ctrl+E 切换模式时保留滚动位置** · 之前会跳到顶部，现在按比例恢复到原阅读 / 编辑位置

### Tech
- 新增依赖：`tauri-plugin-single-instance`、`urlencoding`
- 多窗口通过 URL hash (`#file=<encoded-path>`) 传递文件路径
- Capabilities 放开 `win-*` 通配，新窗口继承所有权限

## [1.0.0] — 2026-04-29

### Added
- **Markdown 渲染** · GFM 完整支持（标题、列表、引用、代码块、表格、删除线、任务列表）
- **代码语法高亮** · highlight.js 主流 30+ 语言（GitHub 风格）
- **阅读 / 编辑 双模式** · `Ctrl+E` 切换，单窗口 Notepad 体感
- **左侧大纲（TOC）** · 自动从标题生成，点击跳转
- **5 语言界面** · 简体中文 / 繁體中文 / English / 日本語 / 한국어，运行时切换无需重启
- **浅色 / 深色 / 跟随系统** 三态主题
- **完整快捷键** · Ctrl+O/S/Shift+S/W/E/F/C/V/X/Z/Y/A/+/-/0/P，F1，F11
- **文件操作**
  - 4 种打开途径：双击 .md / 拖入窗口 / Ctrl+O / 命令行参数
  - UTF-8 / GBK 编码自动识别
  - 大文件保护（5MB 警告 / 20MB 拒绝）
- **可选插件**（帮助菜单开关，按需懒加载）
  - Mermaid 流程图渲染
  - LaTeX 数学公式（KaTeX）
- **首次启动询问** · 是否设为 .md 默认打开方式
- **欢迎屏 + 最近文件**
- **Windows 文件关联** · 安装时静默注册 .md / .markdown / .mdown / .mkd
- **5 语言安装界面**（NSIS）

### Tech
- Tauri 2 + Rust + Windows WebView2
- Vite 5 打包前端 ESM
- marked v12 / highlight.js v11 / DOMPurify v3
- 单元测试 29 个全过（renderer / TOC / i18n）

### Known Limitations
- 未购买代码签名证书 → 安装时 Windows SmartScreen 会弹"未识别的应用"警告，需点"仍要运行"
- 单实例：同一时刻只能开一个文档窗口（v1.1 计划改为多窗口）
