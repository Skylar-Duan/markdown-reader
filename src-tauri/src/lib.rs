mod commands;

use commands::{
    read_file, write_file, file_size, file_exists, get_cli_args, set_as_default_md,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
