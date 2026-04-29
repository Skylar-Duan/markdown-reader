// fileOps.js — file operations (open / save / drag-drop / CLI args / file association)
// Calls Tauri Rust commands via invoke().

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog, message, ask, confirm } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { toast } from "./toast.js";

const SIZE_THRESHOLD_WARN = 5 * 1024 * 1024;
const SIZE_THRESHOLD_REJECT = 20 * 1024 * 1024;
const RECENT_KEY = "md-reader.recent";
const RECENT_MAX = 10;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export class FileOps {
  constructor({ i18n, onLoaded, onSaved, getDirty, getCurrent, onConfirmDiscardCancelled }) {
    this.i18n = i18n;
    this.onLoaded = onLoaded;
    this.onSaved = onSaved;
    this.getDirty = getDirty || (() => false);
    this.getCurrent = getCurrent || (() => ({ filePath: null, rawText: "" }));
    this.onConfirmDiscardCancelled = onConfirmDiscardCancelled;
  }

  async confirmDiscard() {
    if (!this.getDirty()) return true;
    const cur = this.getCurrent();
    const fileName = cur.filePath ? cur.filePath.split(/[\\/]/).pop() : "(untitled)";
    try {
      const result = await ask(
        this.i18n.t("dialog.unsaved.body", { file: fileName }),
        {
          title: this.i18n.t("dialog.unsaved.title"),
          kind: "warning",
          okLabel: this.i18n.t("dialog.unsaved.discard"),
          cancelLabel: this.i18n.t("dialog.unsaved.cancel")
        }
      );
      return result;
    } catch (e) {
      console.error("confirmDiscard error", e);
      return true;
    }
  }

  async open(path) {
    if (!await this.confirmDiscard()) {
      this.onConfirmDiscardCancelled?.();
      return;
    }

    if (!path) {
      try {
        const selected = await openDialog({
          multiple: false,
          filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] }]
        });
        if (!selected) return;
        path = typeof selected === "string" ? selected : selected[0];
      } catch (e) {
        console.error("open dialog error", e);
        return;
      }
    }

    try {
      const exists = await invoke("file_exists", { path });
      if (!exists) {
        toast(this.i18n.t("toast.file_not_found"), "error");
        return;
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
          {
            title: this.i18n.t("dialog.large_file.title"),
            okLabel: this.i18n.t("dialog.continue"),
            cancelLabel: this.i18n.t("dialog.cancel")
          }
        );
        if (!ok) return;
      }

      const result = await invoke("read_file", { path });
      this.onLoaded?.({ path, content: result.content, encoding: result.encoding });
      this.addRecent(path);
    } catch (e) {
      console.error("read file error", e);
      toast(String(e), "error");
    }
  }

  async save() {
    const cur = this.getCurrent();
    if (!cur.filePath) return this.saveAs();
    try {
      await invoke("write_file", { path: cur.filePath, content: cur.rawText });
      this.onSaved?.();
      toast(this.i18n.t("toast.saved"), "info");
    } catch (e) {
      console.error("save error", e);
      toast(String(e), "error");
    }
  }

  async saveAs() {
    const cur = this.getCurrent();
    let path;
    try {
      path = await saveDialog({
        defaultPath: cur.filePath || "untitled.md",
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
      });
    } catch (e) {
      console.error("saveAs dialog error", e);
      return;
    }
    if (!path) return;
    try {
      await invoke("write_file", { path, content: cur.rawText });
      this.onSaved?.(path);
      this.addRecent(path);
      toast(this.i18n.t("toast.saved"), "info");
    } catch (e) {
      console.error("saveAs error", e);
      toast(String(e), "error");
    }
  }

  async setAsDefaultMd() {
    try {
      await invoke("set_as_default_md");
      toast(this.i18n.t("toast.set_default_done"), "info");
    } catch (e) {
      console.error("set_as_default_md error", e);
      toast(this.i18n.t("toast.set_default_failed"), "warning");
    }
  }

  addRecent(path) {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const filtered = recent.filter(p => p !== path);
      filtered.unshift(path);
      localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, RECENT_MAX)));
    } catch (e) {
      console.error("addRecent error", e);
    }
  }

  getRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  }

  clearRecent() {
    localStorage.removeItem(RECENT_KEY);
  }

  setupDragDrop() {
    try {
      const win = getCurrentWebviewWindow();
      win.onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths || [];
          if (paths.length > 0) {
            const md = paths.find(p => /\.(md|markdown|mdown|mkd)$/i.test(p));
            if (md) this.open(md);
          }
        }
      });
    } catch (e) {
      console.error("drag drop setup error", e);
    }
  }

  async setupCliArgs() {
    try {
      const args = await invoke("get_cli_args");
      const path = args.find(a => /\.(md|markdown|mdown|mkd)$/i.test(a));
      if (path) await this.open(path);
    } catch (e) {
      // Not all build modes expose cli args; ignore silently
    }
  }
}
