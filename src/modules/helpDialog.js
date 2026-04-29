// helpDialog.js — built-in help shown as rendered .md content

import { renderMarkdown } from "./renderer.js";

const HELP_MD = {
  "zh-CN": `# 使用说明

## 快捷键
| 操作 | 快捷键 |
|---|---|
| 打开文件 | Ctrl+O |
| 保存 | Ctrl+S |
| 另存为 | Ctrl+Shift+S |
| 切换阅读 / 编辑 | Ctrl+E |
| 显示 / 隐藏大纲 | Ctrl+\\\\ |
| 查找 | Ctrl+F |
| 撤销 / 重做 | Ctrl+Z / Ctrl+Y |
| 复制 / 粘贴 / 剪切 | Ctrl+C / V / X |
| 全选 | Ctrl+A |
| 字号 放大 / 缩小 / 重置 | Ctrl++ / Ctrl+- / Ctrl+0 |
| 全屏 | F11 |
| 帮助 | F1 |

## 设为 .md 默认打开方式
**菜单**：文件 → 设为 .md 默认打开方式（或安装时勾选）。

## 插件
**帮助**菜单里可启用：
- **Mermaid 流程图**：在 .md 里写 \`\`\`mermaid 代码块即可渲染流程图
- **LaTeX 数学公式**：在 .md 里写 \`$E=mc^2$\`（行内）或 \`$$ ... $$\`（独立成段）即可渲染公式

## 切换语言
**右上角 🌐 按钮**：简体中文 / 繁體中文 / English / 日本語 / 한국어 一键切换，无需重启。

## 切换主题
**右上角 🌗 按钮**：浅色 / 深色 / 跟随系统 三态循环切换。
`,
  "zh-TW": `# 使用說明

## 快捷鍵
| 操作 | 快捷鍵 |
|---|---|
| 開啟檔案 | Ctrl+O |
| 儲存 | Ctrl+S |
| 另存新檔 | Ctrl+Shift+S |
| 切換閱讀 / 編輯 | Ctrl+E |
| 顯示 / 隱藏大綱 | Ctrl+\\\\ |
| 尋找 | Ctrl+F |
| 復原 / 重做 | Ctrl+Z / Ctrl+Y |
| 複製 / 貼上 / 剪下 | Ctrl+C / V / X |
| 全選 | Ctrl+A |
| 字級 放大 / 縮小 / 重設 | Ctrl++ / Ctrl+- / Ctrl+0 |
| 全螢幕 | F11 |
| 說明 | F1 |
`,
  "en": `# Help

## Keyboard Shortcuts
| Action | Shortcut |
|---|---|
| Open file | Ctrl+O |
| Save | Ctrl+S |
| Save As | Ctrl+Shift+S |
| Toggle Read / Edit | Ctrl+E |
| Toggle Outline | Ctrl+\\\\ |
| Find | Ctrl+F |
| Undo / Redo | Ctrl+Z / Ctrl+Y |
| Copy / Paste / Cut | Ctrl+C / V / X |
| Select All | Ctrl+A |
| Zoom In / Out / Reset | Ctrl++ / Ctrl+- / Ctrl+0 |
| Fullscreen | F11 |
| Help | F1 |

## Set as default .md handler
**Menu**: File → Set as default for .md files (or check during install).

## Plugins
The **Help** menu has toggles for:
- **Mermaid diagrams**: Write \`\`\`mermaid blocks to render flowcharts
- **LaTeX math**: Write \`$E=mc^2$\` (inline) or \`$$ ... $$\` (display) to render formulas

## Switch language
**Top-right 🌐 button**: instantly switches between 5 languages, no restart needed.

## Switch theme
**Top-right 🌗 button**: cycles light / dark / auto.
`,
  "ja": `# ヘルプ

## キーボードショートカット
| 操作 | ショートカット |
|---|---|
| ファイルを開く | Ctrl+O |
| 保存 | Ctrl+S |
| 名前を付けて保存 | Ctrl+Shift+S |
| 読書 / 編集 切り替え | Ctrl+E |
| アウトライン表示切替 | Ctrl+\\\\ |
| 検索 | Ctrl+F |
| 元に戻す / やり直し | Ctrl+Z / Ctrl+Y |
| コピー / 貼り付け / 切り取り | Ctrl+C / V / X |
| すべて選択 | Ctrl+A |
| 拡大 / 縮小 / リセット | Ctrl++ / Ctrl+- / Ctrl+0 |
| 全画面 | F11 |
| ヘルプ | F1 |
`,
  "ko": `# 도움말

## 키보드 단축키
| 동작 | 단축키 |
|---|---|
| 파일 열기 | Ctrl+O |
| 저장 | Ctrl+S |
| 다른 이름으로 저장 | Ctrl+Shift+S |
| 읽기 / 편집 전환 | Ctrl+E |
| 개요 표시 전환 | Ctrl+\\\\ |
| 찾기 | Ctrl+F |
| 실행 취소 / 다시 실행 | Ctrl+Z / Ctrl+Y |
| 복사 / 붙여넣기 / 잘라내기 | Ctrl+C / V / X |
| 모두 선택 | Ctrl+A |
| 확대 / 축소 / 초기화 | Ctrl++ / Ctrl+- / Ctrl+0 |
| 전체 화면 | F11 |
| 도움말 | F1 |
`
};

export class HelpDialog {
  constructor(i18n) {
    this.i18n = i18n;
  }

  show() {
    const md = HELP_MD[this.i18n.currentLocale] || HELP_MD["en"];
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal modal-help" role="dialog" aria-modal="true">
        <div class="modal-content">${renderMarkdown(md)}</div>
        <div class="modal-actions">
          <button class="modal-btn modal-close-btn">${escapeHtml(this.i18n.t("dialog.ok"))}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector(".modal-close-btn").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", esc);
      }
    });
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
