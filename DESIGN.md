# Markdown Reader · 设计文档

> **版本**：v1 设计稿 · 2026-04-28
> **状态**：待审 → 实施
> **UI 风格**：Notion 风（参见 [`_design-mockups/ui-styles.html`](./_design-mockups/ui-styles.html)）

---

## 1. 项目目标

### 1.1 解决什么问题
Windows 自带的记事本（Notepad）打开 `.md` 文件时只显示原始文本，看不到 Markdown 渲染后的格式（标题大小、加粗、表格、代码块）。日常需要读 .md 文档的人，要么忍受裸文本，要么开 VS Code / Typora（重 / 收费）。

### 1.2 这个工具做什么
做一个**轻量桌面应用**，定位"**给 .md 用的记事本**"：
- 像记事本一样简单（一次开一个文件，没有项目管理、没有插件市场）
- 但默认显示**漂亮渲染**（Notion 风）
- 也能**编辑**（Ctrl+E 切换到原始文本，编辑完保存）
- 装一次后，**双击 .md 就用它打开**

### 1.3 不做什么（YAGNI）
- ❌ WYSIWYG 所见即所得（用模式切换替代，技术稳）
- ❌ 多文件 / 工作区 / 文件浏览器
- ❌ 实时协作 / 云同步
- ❌ 内置 AI 助手
- ❌ 自定义主题市场（只两套：浅 / 深）
- ❌ 插件市场（只内置 2 个可选插件：Mermaid / LaTeX）

---

## 2. 技术选型

| 项目 | 选择 | 理由 |
|---|---|---|
| **桌面壳** | Tauri 2.x | Rust 后端 + 系统 WebView，安装包 ~10MB，启动快，跨平台 |
| **WebView** | Windows WebView2 | Win11 自带，无需额外安装运行时 |
| **前端框架** | 不用框架（Vanilla JS + HTML/CSS） | 应用足够小（< 2000 行 JS），上 React/Vue 是过度工程；性能更好，包体积更小 |
| **MD 解析** | [marked](https://marked.js.org/) v12 | 老牌、维护活跃、支持 GFM、~50KB |
| **代码高亮** | [highlight.js](https://highlightjs.org/) | 200+ 语言支持，中等体积（按语言裁剪后 ~80KB） |
| **HTML 净化** | [DOMPurify](https://github.com/cure53/DOMPurify) | 防止 .md 里的恶意 HTML/JS 执行（重要！） |
| **图标** | Lucide Icons SVG | 开源、Notion 同款风格 |
| **打包** | Tauri Bundler | 直接产 `.msi` + `.exe` 安装包 |
| **代码签名** | ❌ 不做 | 用户接受装时 SmartScreen 警告 |

### 2.1 体积预算
| 模块 | 估算 |
|---|---|
| Tauri runtime（Rust 编译产物） | ~3 MB |
| 前端 HTML/CSS/JS | ~250 KB |
| marked + highlight.js + DOMPurify | ~330 KB |
| 字体文件（思源黑体子集 + Inter） | ~3 MB |
| 图标 + 资源 | ~200 KB |
| 可选 Mermaid（按需加载） | +500 KB |
| 可选 KaTeX（按需加载） | +280 KB |
| **总安装包** | **~7-10 MB**（不算插件） |

---

## 3. 目录结构

```
02-Gadgets/md-reader/
├── README.md
├── DESIGN.md                  ← 本文件
├── _design-mockups/
│   └── ui-styles.html
├── src/                       ← 前端源码
│   ├── index.html             ← 主页面骨架
│   ├── app.js                 ← 应用入口 + 主循环
│   ├── styles/
│   │   ├── theme-light.css    ← 浅色主题（Notion 风）
│   │   ├── theme-dark.css     ← 深色主题
│   │   └── markdown.css       ← MD 渲染样式
│   ├── modules/
│   │   ├── editor.js          ← 编辑模式（textarea + 撤销链）
│   │   ├── renderer.js        ← marked + highlight + sanitize
│   │   ├── toc.js             ← 大纲生成 + 滚动同步
│   │   ├── theme.js           ← 主题切换 + 系统跟随
│   │   ├── i18n.js            ← 5 语言字符串 + 切换
│   │   ├── shortcuts.js       ← 全局快捷键
│   │   ├── menu.js            ← 顶部菜单
│   │   ├── statusbar.js       ← 底部状态栏
│   │   └── plugins/
│   │       ├── mermaid.js     ← 流程图（懒加载）
│   │       └── katex.js       ← 数学公式（懒加载）
│   ├── locales/
│   │   ├── zh-CN.json         ← 简体中文
│   │   ├── zh-TW.json         ← 繁体中文
│   │   ├── en.json            ← English
│   │   ├── ja.json            ← 日本語
│   │   └── ko.json            ← 한국어
│   └── assets/
│       ├── icon.ico           ← 应用图标
│       ├── icon.png           ← 多尺寸 PNG
│       └── fonts/             ← Inter + 思源黑体子集
├── src-tauri/                 ← Tauri 后端（Rust）
│   ├── Cargo.toml
│   ├── tauri.conf.json        ← 应用配置（窗口、签名、文件关联）
│   ├── src/
│   │   ├── main.rs            ← Rust 入口
│   │   └── commands.rs        ← Tauri 命令（读/写文件、对话框、注册关联）
│   ├── icons/                 ← 多平台图标
│   └── installer/
│       └── extra-files.nsh    ← Windows 安装时注册 .md 关联的钩子脚本
├── package.json               ← 前端依赖 + 脚本
├── pnpm-lock.yaml
└── dist/                      ← 编译产物（`.msi` / `.exe`）
```

---

## 4. UI 规范（基于 Notion 风 mockup）

### 4.1 整体布局
```
┌─────────────────────────────────────────────────────┐
│ [🪟 标题栏] 文件名.md — Markdown 阅读器        — ▢ ✕│
├─────────────────────────────────────────────────────┤
│ 文件  编辑  视图  帮助       🌐中文  🌗  📖阅读  │ ← 菜单栏
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ 大纲     │            主内容区                      │
│  • H1    │       （渲染 / 编辑切换显示）             │
│  • H2    │                                          │
│   · H3   │                                          │
│          │                                          │
├──────────┴──────────────────────────────────────────┤
│ 📄 路径 · UTF-8 · 1234 字  📖 阅读模式 · Markdown    │ ← 状态栏
└─────────────────────────────────────────────────────┘
```

### 4.2 设计 token（Notion 风 · 浅色主题）

| Token | 值 | 用途 |
|---|---|---|
| `--bg-primary` | `#FFFFFF` | 主背景 |
| `--bg-sidebar` | `#F7F6F3` | 侧栏 / 状态栏背景 |
| `--bg-hover` | `#EBEAE7` | 悬停态 |
| `--bg-active` | `#E5E3DF` | 选中态 |
| `--border` | `#EBEAE7` | 分隔线 |
| `--text-primary` | `#37352F` | 正文 |
| `--text-secondary` | `#787774` | 二级文字 |
| `--text-tertiary` | `#9B9A97` | 三级文字（标签、提示） |
| `--accent` | `#2F80ED` | 强调（链接、按钮） |
| `--accent-text` | `#FFFFFF` | 强调按钮文字 |
| `--code-bg` | `#F1EFEC` | 行内代码背景 |
| `--code-block-bg` | `#F7F6F3` | 代码块背景 |
| `--code-text` | `#EB5757` | 行内代码文字 |
| 字体（中文） | "Noto Sans SC", "PingFang SC", system-ui | 正文 |
| 字体（西文） | "Inter", system-ui | 正文 |
| 字体（代码） | "JetBrains Mono", "SF Mono", Consolas | 代码 |
| 圆角 | 3-4px（小） / 6px（按钮） | 全局 |
| 阴影 | 无 / 极弱（仅悬浮态用 1px 阴影） | Notion 风零阴影 |

深色主题对应 token 在 `theme-dark.css` 里另行定义（同 key 不同值），保持与 Notion 深色风一致。

### 4.3 菜单结构

#### 「文件」菜单
| 项目 | 快捷键 | 行为 |
|---|---|---|
| 打开... | Ctrl+O | 弹文件选择器 |
| 最近打开 | — | 子菜单，显示最近 10 个 |
| 保存 | Ctrl+S | 保存到原文件 |
| 另存为... | Ctrl+Shift+S | 弹保存对话框 |
| 打印 | Ctrl+P | 调用系统打印（基于渲染态） |
| 设为 .md 默认打开方式 | — | 调系统接口（已设过则灰显） |
| 关闭 | Ctrl+W | 关闭窗口 |

#### 「编辑」菜单
| 项目 | 快捷键 | 行为 |
|---|---|---|
| 撤销 | Ctrl+Z | 仅编辑模式下生效 |
| 重做 | Ctrl+Y | 仅编辑模式下生效 |
| 剪切 | Ctrl+X | |
| 复制 | Ctrl+C | 阅读模式下复制纯文本（不带格式 HTML） |
| 粘贴 | Ctrl+V | 仅编辑模式下生效 |
| 全选 | Ctrl+A | |
| 查找 | Ctrl+F | 浮窗搜索 + 高亮匹配 |

#### 「视图」菜单
| 项目 | 快捷键 | 行为 |
|---|---|---|
| 阅读模式 | Ctrl+E | 切换到渲染态（默认） |
| 编辑模式 | Ctrl+E | 切换到原始文本编辑 |
| 显示大纲 | Ctrl+\ | 显示 / 隐藏侧栏 |
| 浅色主题 | — | 切到浅色 |
| 深色主题 | — | 切到深色 |
| 跟随系统 | — | 自动随系统切换 |
| 放大字号 | Ctrl++ | +1pt |
| 缩小字号 | Ctrl+- | -1pt |
| 重置字号 | Ctrl+0 | 回默认 |

#### 「帮助」菜单
| 项目 | 行为 |
|---|---|
| 使用说明 | 打开内置 Help 窗口（一份 .md 形式的快捷键表 + 功能说明） |
| 启用 Mermaid 流程图 | 切换可选插件 |
| 启用 LaTeX 数学公式 | 切换可选插件 |
| 切换语言 | 子菜单：简体中文 / 繁體中文 / English / 日本語 / 한국어 |
| 关于 | 版本号、作者、GitHub 链接（如已上线） |

### 4.4 模式切换 UX
- 默认进入 **阅读模式**（渲染态）
- 右上角永远显示一个 **📖 阅读 / ✏️ 编辑** 切换按钮（高亮当前态）
- 按 `Ctrl+E` 在两态间循环切换
- 编辑模式下：右上按钮变成 ✏️ 编辑（高亮）+ 旁边出现「未保存 ●」红点（如果有未保存改动）
- 切回阅读模式时**不强制保存**（内存里保留最新文本，重新渲染）
- 关窗口前如果有未保存改动 → 弹「保存 / 不保存 / 取消」对话框

### 4.5 状态栏
左到右：
- `📄 路径`（点击复制路径）
- `UTF-8`（编码，点击切换 UTF-8 / GBK / 自动检测）
- `1234 字 · 87 行`（阅读模式显示渲染后字数；编辑模式显示原始字符 + 行号）
- 中间填充
- `📖 阅读模式` / `✏️ 编辑模式`
- `Markdown`（语法标识）

---

## 5. 国际化（i18n）

### 5.1 支持语言
| 代码 | 名称 | 默认场景 |
|---|---|---|
| `zh-CN` | 简体中文 | 系统语言为 zh-CN 或 zh |
| `zh-TW` | 繁體中文 | 系统语言为 zh-TW / zh-HK |
| `en` | English | 默认兜底 |
| `ja` | 日本語 | 系统语言为 ja |
| `ko` | 한국어 | 系统语言为 ko |

### 5.2 字符串组织
- 一种语言一个 JSON 文件：`src/locales/zh-CN.json` 等
- key 用点分层级：`menu.file.open` / `dialog.unsaved.title` / `status.read_mode`
- 运行时通过 `i18n.t("menu.file.open")` 获取
- 切语言后**全局重渲染菜单 + 状态栏 + 对话框文案**（不需要重启应用）

### 5.3 启动语言策略
1. 读用户上次手动选择（存在 `localStorage`）→ 用之
2. 否则读 Tauri 提供的系统语言 → 匹配最近的支持语言
3. 都没有 → 兜底英文

### 5.4 安装包语言
- Tauri MSI bundler 支持安装界面多语言
- 安装时显示与上述 5 种相同的语言选项
- 用户在安装时选哪种 → 写入 registry，应用首次启动读取后作为默认

---

## 6. 主题系统

| 模式 | 触发 | 行为 |
|---|---|---|
| 浅色 | 用户手选 | 加载 `theme-light.css` |
| 深色 | 用户手选 | 加载 `theme-dark.css` |
| 跟随系统 | **默认** | 监听 OS appearance change，自动切 |

切换实现：根 `<html>` 加 `data-theme="light|dark"` 属性，CSS 用属性选择器响应。

---

## 7. 文件操作

### 7.1 打开文件的 4 种途径
| 途径 | 行为 |
|---|---|
| **双击 .md 文件**（系统关联） | OS 启动应用 + 把路径作为命令行参数传给 Rust → 前端启动后立即加载 |
| 文件 → 打开 | 弹 Tauri 文件对话框（仅 .md / .markdown / .mdown） |
| 拖拽文件到窗口 | Tauri `onFileDrop` 监听，加载之 |
| 命令行 `md-reader.exe path.md` | 启动时 argv[1] 即文件路径 |

### 7.2 保存
- `Ctrl+S` → 保存到原文件（覆盖，与 Notepad 一致）
- 编辑模式下编辑 → 标记 dirty → 状态栏 / 标题栏显示未保存标识
- 保存完成 → 清 dirty 标识

### 7.3 大文件保护
| 文件大小 | 行为 |
|---|---|
| ≤ 1 MB | 直接打开 |
| 1-5 MB | 直接打开，状态栏显示"大文件" |
| 5-20 MB | 弹"文件较大（XX MB），是否继续？" |
| > 20 MB | 拒绝打开，弹"文件过大，建议用专业编辑器" |

### 7.4 编码处理
- 默认按 UTF-8 读
- 失败 → 自动尝试 GBK（中文 Windows 兼容）
- 仍失败 → 提示用户手选编码

### 7.5 安全
- 渲染前用 DOMPurify 净化 HTML（移除 `<script>` / `on*` / `javascript:` URL 等）
- 外链（http/https）→ 调用系统浏览器打开（不在 WebView 内导航）
- 相对路径图片 → 解析为绝对路径后加载（限制在文件所在目录内）
- 绝不执行 .md 里的任何 JS / 嵌入式代码

---

## 8. 快捷键全表

| 快捷键 | 行为 | 适用模式 |
|---|---|---|
| Ctrl+O | 打开文件 | 全部 |
| Ctrl+S | 保存 | 编辑（阅读模式下也能用，等于无操作） |
| Ctrl+Shift+S | 另存为 | 全部 |
| Ctrl+P | 打印 | 全部（基于阅读模式渲染） |
| Ctrl+W | 关闭窗口 | 全部 |
| Ctrl+E | 切换阅读 / 编辑 | 全部 |
| Ctrl+\ | 显示 / 隐藏大纲 | 全部 |
| Ctrl+F | 查找 | 全部 |
| Ctrl+Z | 撤销 | 编辑 |
| Ctrl+Y | 重做 | 编辑 |
| Ctrl+X | 剪切 | 编辑 |
| Ctrl+C | 复制 | 全部（阅读模式复制纯文本） |
| Ctrl+V | 粘贴 | 编辑 |
| Ctrl+A | 全选 | 全部 |
| Ctrl++ | 字号放大 | 全部 |
| Ctrl+- | 字号缩小 | 全部 |
| Ctrl+0 | 字号重置 | 全部 |
| F1 | 打开使用说明 | 全部 |
| F11 | 全屏切换 | 全部 |

---

## 9. 渲染细节

### 9.1 marked 配置
- 启用 GFM（GitHub Flavored Markdown）：表格、删除线、任务列表、自动链接
- `breaks: false`（单行换行 ≠ 段落，符合标准 MD 行为）
- 自定义 renderer：把 H1-H6 加 id（用于大纲点击跳转）

### 9.2 highlight.js
- 默认装载常用 30 种语言（Python, JS, TS, Rust, Go, Java, C/C++, HTML, CSS, JSON, YAML, Bash, SQL, ...）
- 浅色主题用 `github.css`、深色主题用 `github-dark.css`
- 不识别的语言降级为纯文本

### 9.3 链接行为
- 内部锚点（`#section`）→ 滚动到对应标题
- HTTP/HTTPS 外链 → 调 Tauri shell.open，用系统浏览器打开
- 文件链接（`./other.md`）→ 用本应用打开新窗口

### 9.4 图片
- 网络图片 → 直接加载（HTTPS only，HTTP 会被 WebView 拦截，需提示）
- 相对路径 → 解析为绝对路径，限定在文件所在目录树内
- 绝对路径 → 限定在用户文档目录内（防止 `file:///etc/passwd` 类滥用）
- 图片加载失败 → 显示占位图 + 路径

---

## 10. 安装与分发

### 10.1 Tauri Bundler 配置（`tauri.conf.json` 关键项）
```json
{
  "productName": "Markdown Reader",
  "version": "1.0.0",
  "identifier": "com.dbwen.mdreader",
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": ["icons/icon.ico"],
    "windows": {
      "wix": {
        "language": ["en-US", "zh-CN", "zh-TW", "ja-JP", "ko-KR"]
      },
      "fileAssociations": [
        {
          "ext": ["md", "markdown", "mdown"],
          "description": "Markdown Document",
          "role": "Editor"
        }
      ]
    }
  }
}
```

### 10.2 文件关联
- Tauri Bundler 自带文件关联注册（写入 `HKCR\.md\Markdown Reader`）
- 安装界面有勾选框：**「✓ 设为 .md 文件默认打开方式」**（默认勾选）
- 卸载时自动清理注册表

### 10.3 SmartScreen 警告
未签名应用首次运行会弹「Microsoft Defender SmartScreen 阻止了未识别的应用」：
- 用户点「更多信息」→「仍要运行」即可
- 在 README + 帮助菜单里说明

### 10.4 卸载
- 走 Windows 标准卸载流程（控制面板 / 设置 → 应用）
- Tauri Bundler 自动生成卸载程序
- 卸载时清理：注册表项 / 文件关联 / 快捷方式 / 用户配置（可选保留）

---

## 11. 错误处理

| 场景 | 行为 |
|---|---|
| 文件不存在 | 弹 toast "文件不存在或已被移动" |
| 文件无读权限 | 弹 toast "无权限读取此文件" |
| 文件编码不识别 | 弹对话框选编码 |
| 渲染异常（罕见） | 降级为原始文本显示 + 状态栏标红 |
| 保存失败（磁盘满 / 无权限） | 弹对话框，**不丢失**编辑器内容 |
| 插件加载失败（Mermaid/LaTeX） | toast 提示，不影响主流程 |

---

## 12. 测试与验收清单

### 12.1 功能验收（用户手动测）
- [ ] 双击 .md 文件能正常打开（前提：装时勾选了文件关联）
- [ ] 不勾选文件关联也能从开始菜单 / 桌面打开应用
- [ ] 渲染态：标题、列表、引用、代码块、表格、链接、图片都正确
- [ ] 代码高亮：Python / JS / Rust 三种至少各看一次
- [ ] Ctrl+E 切换阅读 / 编辑无丢字
- [ ] 编辑后 Ctrl+S 保存生效（重开看到改动）
- [ ] Ctrl+C / V / Z / Y / A / F 全部按预期工作
- [ ] 五种语言 UI 切换正常（菜单 / 状态栏 / 对话框文案都跟着变）
- [ ] 浅 / 深主题切换正常
- [ ] 大纲点击能滚到对应标题
- [ ] 5MB+ 大文件弹确认对话框
- [ ] 卸载干净（无残留注册表 / 文件关联）

### 12.2 兼容性
- [ ] Win11 24H2（你的系统）
- [ ] Win10 22H2（朋友可能在用）
- [ ] 4K 高分屏（看 UI 是否被拉糊）
- [ ] 100% / 125% / 150% DPI 缩放下都能用

---

## 13. 风险与未决问题

| # | 风险 / 问题 | 缓解 |
|---|---|---|
| R1 | Rust 工具链 1.5GB 安装是重投入 | 一次性投入，未来其他 Tauri 项目共享 |
| R2 | SmartScreen 警告可能让朋友以为是病毒 | README + Help 里明确说明；以后用量大了再考虑 ¥1500/年的签名 |
| R3 | marked 解析极端 .md 可能崩 | 用 try-catch 包裹，失败降级为纯文本 |
| R4 | 文件关联在某些 Win10 上需要管理员权限 | 安装时检测，无权限就跳过关联步骤，UI 提示用户「右键 → 打开方式」手动设 |
| R5 | 编辑大文件时撤销链占内存 | 编辑模式下限制撤销 100 步 |
| R6 | 不同系统字体回退可能让中文看起来不一致 | 内嵌思源黑体子集，确保中文一致；西文回退 system-ui |

---

## 14. 后续路线（不在 v1 范围内）

| v2 想法 | 可能的触发条件 |
|---|---|
| 多 Tab（一个窗口开多个文件） | 你日常需要对比 .md |
| Markdown Lint（语法纠错） | 做内容生产时用 |
| 导出 HTML / PDF（复用 02-Format Convertor 的逻辑） | 想分享渲染结果 |
| WYSIWYG 模式（基于 ProseMirror） | 模式切换体验觉得别扭 |
| AI 助手（基于 Claude API） | 想边读边问问题 |
| 自动签名 + 自动更新 | 用户量起来后 |

---

## 15. 决策记录（ADR）

| # | 决策 | 拒绝的备选 | 理由 |
|---|---|---|---|
| 1 | 用 Tauri 不用 Electron | Electron | 安装包小 10x，启动快，更接近"轻量记事本" |
| 2 | 不用前端框架（Vanilla） | React / Vue | 应用规模小，框架是过度工程 |
| 3 | 模式切换 UX 不用 WYSIWYG | Typora 式 WYSIWYG | 实现复杂度爆炸，v1 求稳 |
| 4 | 跳过代码签名 | Sectigo OV (¥1500/yr) | 自用为主，不值得 |
| 5 | 用 marked 不用 markdown-it | markdown-it | 默认配置更接近预期，体积更小 |
| 6 | 五语言（多繁中） | 仅中英 / 加更多 | 5 种是亚洲常见语言全集，多了文件膨胀 |
| 7 | Notion UI 风格 | Apple 文档风 / 极简黑白 | 用户选定 |
| 8 | 插件内置（不分发） | 插件市场 | YAGNI，2 个插件多 1MB 无所谓 |

---

## 附录 A：用户测试通过后才上 GitHub
- 本应用先在用户本机测试 → 用户判定通过 → 才上传 GitHub Releases
- 仓库可见性：暂定 private，调通后转 public
- 上 GitHub 时另开 README（英文版）介绍项目
