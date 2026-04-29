mod commands;

use commands::{
    read_file, write_file, file_size, file_exists, get_cli_args, set_as_default_md,
};
use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Find a Markdown-looking file path in argv (skipping argv[0] = exe path).
fn find_md_arg(args: &[String]) -> Option<&String> {
    args.iter().skip(1).find(|a| {
        let lower = a.to_lowercase();
        lower.ends_with(".md")
            || lower.ends_with(".markdown")
            || lower.ends_with(".mdown")
            || lower.ends_with(".mkd")
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Single-instance plugin: when a 2nd launch happens, route the new
        // file argument to the existing process which spawns a new window.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            log::info!("second instance args: {:?}", args);
            let file = find_md_arg(&args);
            let label = format!(
                "win-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            );
            let url = match file {
                Some(f) => format!("index.html#file={}", urlencoding::encode(f)),
                None => "index.html".to_string(),
            };
            match WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
                .title("Markdown Reader")
                .inner_size(1100.0, 760.0)
                .min_inner_size(600.0, 400.0)
                .center()
                .build()
            {
                Ok(_) => log::info!("created new window: {}", label),
                Err(e) => log::error!("failed to create window: {}", e),
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
