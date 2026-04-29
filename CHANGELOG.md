# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
