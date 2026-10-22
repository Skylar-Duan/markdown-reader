import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// Native queues own incoming requests until the receiving document is ready.
export async function connectWorkspace(handlers) {
  if (!isTauri()) return null;
  const window = getCurrentWebviewWindow();
  const unlisten = await Promise.all([
    listen("open-files-available", () => handlers.onFiles?.()),
    listen("tab-transfers-available", () => handlers.onTransfers?.()),
    listen("tab-transfer-committed", event => handlers.onCommitted?.(event.payload)),
    listen("tab-transfer-failed", event => handlers.onFailed?.(event.payload)),
    listen("workspace-window-closed", event => handlers.onWindowClosed?.(event.payload.label)),
    listen("tab-drop-preview", event => handlers.onDropPreview?.(event.payload)),
  ]);
  const bootstrap = await invoke("window_bootstrap");
  return {
    label: window.label, bootstrap, window,
    takeFiles: () => invoke("take_open_files"),
    takeTransfers: () => invoke("take_tab_transfers"),
    acknowledge: token => invoke("ack_tab_transfer", { token }),
    newWindow: () => invoke("new_document_window"),
    target: () => invoke("tab_drag_target"),
    preview: (target = null, clientX = null) => invoke("tab_drag_preview", { target, clientX }),
    transfer: (payload, target = null, index = null) => invoke("begin_tab_transfer", { payload, target, index }),
    cancelTransfer: token => invoke("cancel_tab_transfer", { token }),
    dispose: () => unlisten.forEach(fn => fn()),
  };
}
