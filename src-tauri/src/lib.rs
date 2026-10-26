use std::{fs, io::ErrorKind, path::PathBuf};
use tauri::Manager;

const DB_FILE: &str = "didebaan.json";

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(DB_FILE))
}

/// Returns the saved database JSON, or `None` on first launch.
#[tauri::command]
fn load_db(app: tauri::AppHandle) -> Result<Option<String>, String> {
    match fs::read_to_string(db_path(&app)?) {
        Ok(json) => Ok(Some(json)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Writes the database atomically, keeping the previous version as `didebaan.json.bak`.
#[tauri::command]
fn save_db(app: tauri::AppHandle, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("invalid JSON: {e}"))?;
    let path = db_path(&app)?;
    if path.exists() {
        fs::copy(&path, path.with_extension("json.bak")).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// Folder that holds the database, shown in Settings.
#[tauri::command]
fn data_dir(app: tauri::AppHandle) -> Result<String, String> {
    Ok(db_path(&app)?.parent().map(|p| p.display().to_string()).unwrap_or_default())
}

/// Saves a backup copy into the user's Downloads folder and returns its full path.
#[tauri::command]
fn export_backup(app: tauri::AppHandle, json: String, file_name: String) -> Result<String, String> {
    if file_name.is_empty() || file_name.contains(['/', '\\']) || file_name.starts_with('.') {
        return Err("invalid file name".into());
    }
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let path = dir.join(file_name);
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_db, save_db, data_dir, export_backup])
        .run(tauri::generate_context!())
        .expect("error while running Didebaan");
}
