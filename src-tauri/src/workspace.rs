//! Native window routing and acknowledged tab moves. Document payloads remain
//! in memory; the source tab is removed only after the destination acknowledges.
use serde::Serialize;
use serde_json::{json, Value};
use std::{collections::{HashMap, VecDeque}, sync::Mutex, time::{Duration, Instant}};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const TRANSFER_LIFETIME: Duration = Duration::from_secs(120);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transfer {
    token: String,
    source: String,
    source_tab_id: Value,
    payload: Value,
    index: Option<usize>,
}

struct PendingTransfer {
    target: String,
    transfer: Transfer,
    created: Instant,
}

#[derive(Default)]
struct WindowRecord {
    restore: bool,
    bootstrapped: bool,
    paths: VecDeque<String>,
}

#[derive(Default)]
struct Inner {
    windows: HashMap<String, WindowRecord>,
    pending_files: VecDeque<String>,
    last_focused: Option<String>,
    next_window: u64,
    next_transfer: u64,
    transfers: HashMap<String, PendingTransfer>,
    completed: VecDeque<(String, String)>,
    preview: Option<String>,
}

#[derive(Default)]
pub struct Workspace(Mutex<Inner>);

impl Inner {
    fn target(&self) -> Option<String> {
        self.last_focused.as_ref().filter(|label| self.windows.contains_key(*label)).cloned()
            .or_else(|| self.windows.keys().min().cloned())
    }

    fn register(&mut self, label: &str, restore: bool) {
        let mut record = WindowRecord { restore, ..Default::default() };
        record.paths.append(&mut self.pending_files);
        self.windows.insert(label.into(), record);
    }

    fn queue_files(&mut self, paths: Vec<String>) -> Option<String> {
        let target = self.target();
        if let Some(label) = &target {
            if let Some(window) = self.windows.get_mut(label) { window.paths.extend(paths); }
        } else {
            self.pending_files.extend(paths);
        }
        target
    }

    fn expire(&mut self) -> Vec<Transfer> {
        let failed = self.transfers.values().filter(|entry| entry.created.elapsed() >= TRANSFER_LIFETIME)
            .map(|entry| entry.transfer.clone()).collect();
        self.transfers.retain(|_, entry| entry.created.elapsed() < TRANSFER_LIFETIME);
        failed
    }

    fn transfers_for(&self, label: &str) -> Vec<Transfer> {
        let mut entries: Vec<_> = self.transfers.values().filter(|entry| entry.target == label).collect();
        entries.sort_by_key(|entry| entry.created);
        entries.into_iter().map(|entry| entry.transfer.clone()).collect()
    }

    fn bootstrap(&mut self, label: &str) -> Result<Bootstrap, String> {
        let record = self.windows.get_mut(label).ok_or("unknown document window")?;
        let restore = record.restore && !record.bootstrapped;
        record.bootstrapped = true;
        let paths = record.paths.drain(..).collect();
        Ok(Bootstrap { restore, paths, transfers: self.transfers_for(label) })
    }

    fn cancel_transfer(&mut self, token: &str, source: &str) -> Result<Option<Transfer>, String> {
        let Some(entry) = self.transfers.get(token) else { return Ok(None); };
        if entry.transfer.source != source { return Err("only the source can cancel a tab transfer".into()); }
        Ok(self.transfers.remove(token).map(|entry| entry.transfer))
    }

    fn remove_window(&mut self, label: &str) -> Vec<Transfer> {
        self.windows.remove(label);
        let failed = self.transfers.values().filter(|entry| entry.target == label)
            .map(|entry| entry.transfer.clone()).collect();
        self.transfers.retain(|_, entry| entry.target != label && entry.transfer.source != label);
        if self.last_focused.as_deref() == Some(label) { self.last_focused = None; }
        if self.preview.as_deref() == Some(label) { self.preview = None; }
        failed
    }
}

impl Workspace {
    pub fn target(&self) -> Option<String> { self.0.lock().unwrap().target() }

    pub fn register_main(&self, paths: Vec<String>) {
        let mut inner = self.0.lock().unwrap();
        inner.register("main", true);
        inner.windows.get_mut("main").unwrap().paths.extend(paths);
    }

    pub fn queue_files(&self, app: &AppHandle, paths: Vec<String>) {
        let target = self.0.lock().unwrap().queue_files(paths);
        if let Some(label) = target {
            let _ = app.emit_to(&label, "open-files-available", ());
        }
    }

    pub fn focus(&self, label: &str) {
        let mut inner = self.0.lock().unwrap();
        if inner.windows.contains_key(label) { inner.last_focused = Some(label.into()); }
    }

    pub fn close(&self, app: &AppHandle, label: &str) {
        let (empty, failed) = {
            let mut inner = self.0.lock().unwrap();
            let failed = inner.remove_window(label);
            (inner.windows.is_empty(), failed)
        };
        notify_failed(app, failed);
        let _ = app.emit("workspace-window-closed", json!({ "label": label }));
        #[cfg(target_os = "windows")]
        if empty {
            // Do not accept a file into a process whose last document window has
            // already gone. A simultaneous Explorer launch starts a fresh session.
            tauri_plugin_single_instance::destroy(app);
        }
        // Tauri's normal last-window-destroyed path exits the event loop, which
        // exits the process; the plugin's final destroy is idempotent on Windows.
    }
}

pub fn background_test() -> bool {
    std::env::var("MD_READER_BACKGROUND_TEST").as_deref() == Ok("1")
}

fn notify_failed(app: &AppHandle, transfers: Vec<Transfer>) {
    for transfer in transfers {
        let _ = app.emit_to(&transfer.source, "tab-transfer-failed", json!({
            "token": transfer.token, "sourceTabId": transfer.source_tab_id
        }));
    }
}

#[derive(Serialize)]
pub struct Bootstrap {
    restore: bool,
    paths: Vec<String>,
    transfers: Vec<Transfer>,
}

#[tauri::command]
pub fn window_bootstrap(window: WebviewWindow, workspace: State<'_, Workspace>) -> Result<Bootstrap, String> {
    let mut inner = workspace.0.lock().map_err(|_| "workspace unavailable")?;
    notify_failed(window.app_handle(), inner.expire());
    inner.bootstrap(window.label())
}

#[tauri::command]
pub fn take_open_files(window: WebviewWindow, workspace: State<'_, Workspace>) -> Result<Vec<String>, String> {
    let mut inner = workspace.0.lock().map_err(|_| "workspace unavailable")?;
    let record = inner.windows.get_mut(window.label()).ok_or("unknown document window")?;
    Ok(record.paths.drain(..).collect())
}

fn reserve_window(workspace: &Workspace) -> String {
    let mut inner = workspace.0.lock().unwrap();
    inner.next_window += 1;
    let label = format!("document-{}", inner.next_window);
    inner.register(&label, false);
    label
}

fn create_window(app: &AppHandle, label: &str) -> Result<(), String> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("Markdown Reader").inner_size(1100.0, 760.0)
        .min_inner_size(600.0, 400.0).visible(!background_test()).focused(!background_test())
        .build().map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn new_document_window(window: WebviewWindow, workspace: State<'_, Workspace>) -> Result<String, String> {
    let label = reserve_window(&workspace);
    if let Err(error) = create_window(window.app_handle(), &label) {
        workspace.0.lock().unwrap().remove_window(&label);
        return Err(error);
    }
    Ok(label)
}

#[derive(Serialize)]
pub struct TransferStarted { token: String, target: String }

#[tauri::command]
pub async fn begin_tab_transfer(window: WebviewWindow, workspace: State<'_, Workspace>, target: Option<String>, payload: Value, index: Option<usize>) -> Result<TransferStarted, String> {
    if !payload.is_object() { return Err("tab payload must be an object".into()); }
    let source_tab_id = payload.get("sourceTabId").or_else(|| payload.get("id")).cloned().ok_or("tab id is required")?;
    let new_window = target.is_none();
    let target_label;
    let token;
    {
        let mut inner = workspace.0.lock().map_err(|_| "workspace unavailable")?;
        notify_failed(window.app_handle(), inner.expire());
        if !inner.windows.contains_key(window.label()) { return Err("source window has closed".into()); }
        if inner.transfers.values().any(|entry| entry.transfer.source == window.label() && entry.transfer.source_tab_id == source_tab_id) {
            return Err("this tab already has a pending transfer".into());
        }
        target_label = match target {
            Some(label) => {
                if label == window.label() { return Err("cannot transfer to the same window".into()); }
                if !inner.windows.contains_key(&label) { return Err("destination window has closed".into()); }
                label
            }
            None => {
                inner.next_window += 1;
                let label = format!("document-{}", inner.next_window);
                inner.register(&label, false);
                label
            }
        };
        inner.next_transfer += 1;
        token = format!("tab-transfer-{}", inner.next_transfer);
        let transfer = Transfer { token: token.clone(), source: window.label().into(), source_tab_id, payload, index };
        inner.transfers.insert(token.clone(), PendingTransfer { target: target_label.clone(), transfer, created: Instant::now() });
    }
    if new_window {
        if let Err(error) = create_window(window.app_handle(), &target_label) {
            workspace.0.lock().unwrap().remove_window(&target_label);
            return Err(error);
        }
    }
    let _ = window.app_handle().emit_to(&target_label, "tab-transfers-available", ());
    Ok(TransferStarted { token, target: target_label })
}

#[tauri::command]
pub fn take_tab_transfers(window: WebviewWindow, workspace: State<'_, Workspace>) -> Result<Vec<Transfer>, String> {
    let mut inner = workspace.0.lock().map_err(|_| "workspace unavailable")?;
    notify_failed(window.app_handle(), inner.expire());
    // Redelivery is intentional until ACK: listeners may be installed after the
    // first notification. Frontends deduplicate by token before adding a tab.
    Ok(inner.transfers_for(window.label()))
}

#[tauri::command]
pub fn ack_tab_transfer(window: WebviewWindow, workspace: State<'_, Workspace>, token: String) -> Result<bool, String> {
    let mut inner = workspace.0.lock().map_err(|_| "workspace unavailable")?;
    if inner.completed.iter().any(|(done, target)| done == &token && target == window.label()) { return Ok(true); }
    notify_failed(window.app_handle(), inner.expire());
    let Some(entry) = inner.transfers.get(&token) else { return Ok(false); };
    if entry.target != window.label() { return Err("only the destination can acknowledge a tab".into()); }
    // Keep the transaction if native dispatch fails; the source must retain text.
    window.app_handle().emit_to(&entry.transfer.source, "tab-transfer-committed", json!({
        "token": token, "sourceTabId": entry.transfer.source_tab_id
    })).map_err(|error| error.to_string())?;
    inner.transfers.remove(&token);
    inner.completed.push_back((token, window.label().into()));
    if inner.completed.len() > 256 { inner.completed.pop_front(); }
    Ok(true)
}

#[tauri::command]
pub fn cancel_tab_transfer(window: WebviewWindow, workspace: State<'_, Workspace>, token: String) -> Result<bool, String> {
    let mut inner = workspace.0.lock().map_err(|_| "workspace unavailable")?;
    let Some(transfer) = inner.cancel_transfer(&token, window.label())? else { return Ok(false); };
    notify_failed(window.app_handle(), vec![transfer]);
    Ok(true)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DragTarget { label: String, client_x: f64 }

fn inside_tab_bar(x: f64, y: f64, width: f64) -> bool {
    x >= 0.0 && x < width && (0.0..48.0).contains(&y)
}

#[tauri::command]
pub fn tab_drag_target(window: WebviewWindow) -> Result<Option<DragTarget>, String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::{Foundation::POINT, UI::{WindowsAndMessaging::{GetAncestor, GetCursorPos, WindowFromPoint, GA_ROOT}, HiDpi::GetDpiForWindow}, Graphics::Gdi::ScreenToClient};
        let mut point = POINT { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut point) } == 0 { return Ok(None); }
        let root = unsafe { GetAncestor(WindowFromPoint(point), GA_ROOT) };
        for (label, target) in window.app_handle().webview_windows() {
            if label == window.label() { continue; }
            let handle = target.hwnd().map_err(|error| error.to_string())?.0 as _;
            if handle != root { continue; }
            let mut client = point;
            if unsafe { ScreenToClient(handle, &mut client) } == 0 { return Ok(None); }
            let scale = (unsafe { GetDpiForWindow(handle) } as f64 / 96.0).max(1.0);
            let x = client.x as f64 / scale;
            let y = client.y as f64 / scale;
            let width = target.inner_size().map_err(|error| error.to_string())?.width as f64 / scale;
            if inside_tab_bar(x, y, width) { return Ok(Some(DragTarget { label, client_x: x })); }
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn tab_drag_preview(window: WebviewWindow, workspace: State<'_, Workspace>, target: Option<String>, client_x: Option<f64>) -> Result<(), String> {
    let old;
    let next = target.filter(|label| label != window.label() && window.app_handle().get_webview_window(label).is_some());
    {
        let mut inner = workspace.0.lock().map_err(|_| "workspace unavailable")?;
        old = inner.preview.take();
        inner.preview = next.clone();
    }
    if let Some(old) = old.filter(|old| Some(old) != next.as_ref()) {
        let _ = window.app_handle().emit_to(&old, "tab-drop-preview", json!({ "clientX": null }));
    }
    if let Some(target) = next {
        let x = client_x.filter(|x| x.is_finite());
        let _ = window.app_handle().emit_to(&target, "tab-drop-preview", json!({ "clientX": x }));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn files_queued_before_frontend_and_window_exist_survive() {
        let mut workspace = Inner::default();
        assert_eq!(workspace.queue_files(vec!["a.md".into()]), None);
        workspace.register("main", true);
        assert_eq!(workspace.windows["main"].paths.front().unwrap(), "a.md");
        workspace.queue_files(vec!["b.md".into()]);
        assert_eq!(workspace.windows["main"].paths.len(), 2);
    }

    #[test]
    fn normal_open_targets_focused_remaining_window() {
        let mut workspace = Inner::default();
        workspace.register("main", true);
        workspace.register("document-1", false);
        workspace.last_focused = Some("document-1".into());
        assert_eq!(workspace.queue_files(vec!["a.md".into()]), Some("document-1".into()));
        workspace.remove_window("main");
        assert_eq!(workspace.target(), Some("document-1".into()));
        assert!(!workspace.windows["document-1"].restore);
    }

    #[test]
    fn only_first_window_first_boot_can_restore_and_bootstrap_drains_paths() {
        let mut workspace = Inner::default();
        workspace.register("main", true);
        workspace.queue_files(vec!["a.md".into()]);
        let first = workspace.bootstrap("main").unwrap();
        assert!(first.restore);
        assert_eq!(first.paths, vec!["a.md"]);
        assert!(!workspace.bootstrap("main").unwrap().restore);
        assert!(workspace.bootstrap("main").unwrap().paths.is_empty());
        workspace.register("document-1", false);
        assert!(!workspace.bootstrap("document-1").unwrap().restore);
    }

    #[test]
    fn closed_destination_cancels_without_committing_source() {
        let mut workspace = Inner::default();
        workspace.register("main", true);
        workspace.register("document-1", false);
        workspace.transfers.insert("t".into(), PendingTransfer {
            target: "document-1".into(), created: Instant::now(),
            transfer: Transfer { token: "t".into(), source: "main".into(), source_tab_id: json!(1), payload: json!({"rawText":"unsaved"}), index: Some(0) }
        });
        assert_eq!(workspace.transfers["t"].transfer.payload["rawText"], "unsaved");
        let failed = workspace.remove_window("document-1");
        assert_eq!(failed.len(), 1);
        assert_eq!(failed[0].token, "t");
        assert_eq!(failed[0].source, "main");
        assert_eq!(failed[0].source_tab_id, json!(1));
        assert!(workspace.transfers.is_empty());
        assert!(workspace.windows.contains_key("main"));
    }

    #[test]
    fn stale_transfers_expire_without_native_commit() {
        let mut workspace = Inner::default();
        workspace.transfers.insert("t".into(), PendingTransfer {
            target: "other".into(), created: Instant::now() - TRANSFER_LIFETIME,
            transfer: Transfer { token: "t".into(), source: "main".into(), source_tab_id: json!(1), payload: json!({}), index: None }
        });
        let failed = workspace.expire();
        assert_eq!(failed.len(), 1);
        assert_eq!(failed[0].token, "t");
        assert!(workspace.transfers.is_empty());
    }

    #[test]
    fn only_source_cancels_and_late_ack_has_no_pending_transaction() {
        let mut workspace = Inner::default();
        workspace.transfers.insert("t".into(), PendingTransfer {
            target: "other".into(), created: Instant::now(),
            transfer: Transfer { token: "t".into(), source: "main".into(), source_tab_id: json!(3), payload: json!({"rawText":"keep me"}), index: None }
        });
        assert!(workspace.cancel_transfer("t", "other").is_err());
        assert_eq!(workspace.transfers.len(), 1);
        let canceled = workspace.cancel_transfer("t", "main").unwrap().unwrap();
        assert_eq!(canceled.payload["rawText"], "keep me");
        assert!(workspace.transfers.get("t").is_none());
        assert!(workspace.cancel_transfer("t", "main").unwrap().is_none());
    }

    #[test]
    fn hit_testing_excludes_title_bar_content_and_outside_edges() {
        assert!(inside_tab_bar(0.0, 0.0, 800.0));
        assert!(inside_tab_bar(400.0, 37.0, 800.0));
        assert!(!inside_tab_bar(1.0, -1.0, 800.0));
        assert!(!inside_tab_bar(1.0, 48.0, 800.0));
        assert!(!inside_tab_bar(800.0, 20.0, 800.0));
    }
}
