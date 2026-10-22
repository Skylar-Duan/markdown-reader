mod commands;
mod workspace;

use commands::{
    read_file, write_file, file_size, file_exists, get_cli_args, set_as_default_md,
};
use tauri::Manager;
use workspace::Workspace;

/// Keep every Markdown argument in its original arrival order (skip exe path).
fn find_md_args(args: &[String]) -> Vec<String> {
    args.iter().skip(1).filter(|a| {
        let lower = a.to_lowercase();
        lower.ends_with(".md")
            || lower.ends_with(".markdown")
            || lower.ends_with(".mdown")
            || lower.ends_with(".mkd")
    }).cloned().collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Workspace::default())
        // Single-instance plugin: when a 2nd launch happens, route the file
        // argument to the existing primary instance which opens it as a NEW TAB.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            log::info!("second instance args: {:?}", args);
            let workspace = app.state::<Workspace>();
            let paths = find_md_args(&args).into_iter().map(|file| {
                let path = std::path::Path::new(&file);
                let absolute = if path.is_absolute() { path.to_path_buf() } else { std::path::Path::new(&cwd).join(path) };
                absolute.to_string_lossy().into_owned()
            }).collect::<Vec<_>>();
            workspace.queue_files(app, paths);
            if workspace::background_test() { return; }
            if let Some(main) = workspace.target().and_then(|label| app.get_webview_window(&label)) {
                // Restore from minimized / hidden state, then bring to front.
                // set_focus() alone doesn't unminimize on Windows.
                // unminimize() is unconditional: it's a no-op if not minimized,
                // and is_minimized() can return stale state in some cases.
                let _ = main.unminimize();
                let _ = main.show();
                let _ = main.set_focus();
            }
        }))
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let paths = find_md_args(&args);
            app.state::<Workspace>().register_main(paths);
            if workspace::background_test() {
                if let Some(main) = app.get_webview_window("main") { let _ = main.hide(); }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            let workspace = window.app_handle().state::<Workspace>();
            match event {
                tauri::WindowEvent::Focused(true) => workspace.focus(window.label()),
                tauri::WindowEvent::Destroyed => workspace.close(window.app_handle(), window.label()),
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            file_size,
            file_exists,
            get_cli_args,
            set_as_default_md,
            workspace::window_bootstrap,
            workspace::take_open_files,
            workspace::new_document_window,
            workspace::begin_tab_transfer,
            workspace::take_tab_transfers,
            workspace::ack_tab_transfer,
            workspace::cancel_tab_transfer,
            workspace::tab_drag_target,
            workspace::tab_drag_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn all_markdown_arguments_preserve_order() {
        let args = ["reader.exe", "a.md", "ignored.txt", "B.MARKDOWN", "c.mdown", "d.mkd"]
            .map(str::to_string);
        assert_eq!(super::find_md_args(&args), vec!["a.md", "B.MARKDOWN", "c.mdown", "d.mkd"]);
    }
}
