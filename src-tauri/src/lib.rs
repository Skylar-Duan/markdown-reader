mod commands;

use commands::{
    read_file, write_file, file_size, file_exists, get_cli_args, set_as_default_md,
};
use tauri::{Emitter, Manager};

/// Find a Markdown-looking file path in argv (skipping argv[0] = exe path).
fn find_md_arg(args: &[String]) -> Option<String> {
    args.iter().skip(1).find(|a| {
        let lower = a.to_lowercase();
        lower.ends_with(".md")
            || lower.ends_with(".markdown")
            || lower.ends_with(".mdown")
            || lower.ends_with(".mkd")
    }).cloned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Single-instance plugin: when a 2nd launch happens, route the file
        // argument to the existing primary instance which opens it as a NEW TAB.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            log::info!("second instance args: {:?}", args);
            if let Some(file) = find_md_arg(&args) {
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.set_focus();
                    // Frontend listens on event "open-file-in-tab"
                    let _ = app.emit("open-file-in-tab", file);
                }
            } else {
                // No file → just focus existing window
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            file_size,
            file_exists,
            get_cli_args,
            set_as_default_md,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
