use std::fs;
use std::path::Path;
use serde::Serialize;
use encoding_rs::GBK;

#[derive(Serialize)]
pub struct FileResult {
    pub content: String,
    pub encoding: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<FileResult, String> {
    let bytes = fs::read(&path).map_err(|e| format!("read failed: {}", e))?;
    let size_bytes = bytes.len() as u64;
    let (content, encoding) = decode_with_fallback(&bytes);
    Ok(FileResult { content, encoding, size_bytes })
}

fn decode_with_fallback(bytes: &[u8]) -> (String, String) {
    // 1. Strict UTF-8
    if let Ok(s) = std::str::from_utf8(bytes) {
        return (s.to_string(), "UTF-8".to_string());
    }
    // 2. Detector for non-UTF8
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let enc = detector.guess(None, true);
    let (decoded, _, had_errors) = enc.decode(bytes);
    if !had_errors {
        return (decoded.into_owned(), enc.name().to_string());
    }
    // 3. GBK fallback
    let (decoded, _, _) = GBK.decode(bytes);
    (decoded.into_owned(), "GBK".to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("write failed: {}", e))
}

#[tauri::command]
pub fn file_size(path: String) -> Result<u64, String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(meta.len())
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn get_cli_args() -> Vec<String> {
    std::env::args().skip(1).collect()
}

/// Set this app as the default handler for .md files (Windows registry).
/// Best-effort; may fail without admin rights — UI should fall back gracefully.
#[tauri::command]
pub fn set_as_default_md() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Use Windows ftype/assoc — these per-user commands work without admin
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("get exe path: {}", e))?
            .to_string_lossy()
            .to_string();
        let progid = "MarkdownReader.md";

        // Register: HKCU\Software\Classes\.md -> MarkdownReader.md
        let cmd1 = format!(
            "reg add \"HKCU\\Software\\Classes\\.md\" /ve /t REG_SZ /d \"{}\" /f",
            progid
        );
        let cmd2 = format!(
            "reg add \"HKCU\\Software\\Classes\\.markdown\" /ve /t REG_SZ /d \"{}\" /f",
            progid
        );
        // Register the ProgId with open command
        let cmd3 = format!(
            "reg add \"HKCU\\Software\\Classes\\{}\" /ve /t REG_SZ /d \"Markdown Document\" /f",
            progid
        );
        let cmd4 = format!(
            "reg add \"HKCU\\Software\\Classes\\{}\\shell\\open\\command\" /ve /t REG_SZ /d \"\\\"{}\\\" \\\"%1\\\"\" /f",
            progid, exe_path
        );

        for cmd in [&cmd1, &cmd2, &cmd3, &cmd4] {
            let status = Command::new("cmd")
                .args(["/C", cmd])
                .status()
                .map_err(|e| format!("exec failed: {}", e))?;
            if !status.success() {
                return Err(format!("registry write failed for: {}", cmd));
            }
        }

        // Notify Explorer to refresh associations
        let _ = Command::new("cmd")
            .args(["/C", "ie4uinit.exe -ClearIconCache"])
            .status();

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Only supported on Windows".to_string())
    }
}
