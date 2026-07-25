# Markdown Reader

Windows 上的 Markdown 阅读 / 编辑器。双击 `.md` 就打开，排版漂亮，`Ctrl+E` 切到所见即所得编辑。

像记事本一样简单，但认识 Markdown。

## 下载

到 [Releases](https://github.com/Skylar-Duan/markdown-reader/releases/latest) 下载 `Markdown Reader_x.y.z_x64-setup.exe`，双击安装。

- 装在 `%LOCALAPPDATA%\Programs\`，**不需要管理员权限**
- 没买代码签名证书，Windows SmartScreen 会提示"未知发布者" → 点 **更多信息** → **仍要运行**
- 安装时勾选 *Set as default for .md files*，之后双击 `.md` 直接用它打开（也可事后在「文件」菜单里设）
- 同时提供 5 语言 `.msi`，适合企业批量部署

## 功能

**阅读模式**
- GFM 完整渲染：表格、任务列表、删除线、脚注
- 30+ 语言代码高亮
- 左侧大纲自动生成，点击跳转
- 可选插件：Mermaid 流程图、LaTeX 数学公式（「帮助」菜单里开关）

**编辑模式**（`Ctrl+E`）
- 所见即所得：边打字边看到排版效果
- 工具栏：标题、加粗、斜体、删除线、行内代码、链接、列表、引用、代码块、表格
- 也可切换成纯 Markdown 源码视图

**其它**
- 多标签：一个窗口管所有文件，每个标签独立记住模式 / 滚动位置 / 未保存状态
- 5 语言界面（简中 / 繁中 / English / 日本語 / 한국어），切换无需重启
- 浅色 / 深色 / 跟随系统
- UTF-8 与 GBK 自动识别；大文件保护（5MB 提示，20MB 拒绝）
- 完全离线运行，无遥测、无联网请求

## 快捷键

| 操作 | 快捷键 |
|---|---|
| 打开 / 保存 / 另存为 | `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| 切换阅读 · 编辑 | `Ctrl+E` |
| 新建 / 关闭标签 | `Ctrl+T` / `Ctrl+W` |
| 切换标签 | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| 查找 | `Ctrl+F` |
| 显示 / 隐藏大纲 | `Ctrl+\` |
| 字号 放大 / 缩小 / 重置 | `Ctrl++` / `Ctrl+-` / `Ctrl+0` |
| 全屏 / 帮助 | `F11` / `F1` |

## 从源码构建

需要 Node 20+、[pnpm](https://pnpm.io/)、[Rust 工具链](https://rustup.rs/)，以及 WebView2（Win10/11 自带）。

```bash
pnpm install
pnpm tauri dev      # 开发模式
pnpm test           # 单元测试
pnpm tauri build    # 打安装包 → src-tauri/target/release/bundle/
```

## 技术栈

Tauri 2（Rust + WebView2）· marked + highlight.js + DOMPurify（渲染）· [Vditor](https://github.com/Vanessa219/vditor)（编辑）· Vite

## 许可

[MIT](./LICENSE)
