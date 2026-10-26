use std::{
    fs,
    io::ErrorKind,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_positioner::{Position, WindowExt};

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

/// Launch argument used by the login item so the app starts quietly in the menu bar.
const BACKGROUND_ARG: &str = "--background";

/// When the menu bar panel last lost focus. Clicking the tray icon while the panel is open
/// first blurs it (hiding it), then delivers the click; this lets the click close it for good.
struct TrayState {
    hidden_at: Mutex<Option<Instant>>,
}

fn show_main_window(app: &AppHandle) {
    if let Some(tray) = app.get_webview_window("tray") {
        let _ = tray.hide();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
}

fn toggle_tray_window(app: &AppHandle) {
    let Some(panel) = app.get_webview_window("tray") else { return };
    if panel.is_visible().unwrap_or(false) {
        let _ = panel.hide();
        return;
    }
    let just_hidden = app
        .state::<TrayState>()
        .hidden_at
        .lock()
        .ok()
        .and_then(|t| *t)
        .is_some_and(|t| t.elapsed() < Duration::from_millis(250));
    if just_hidden {
        return;
    }
    let _ = panel.move_window(Position::TrayBottomCenter);
    let _ = panel.show();
    let _ = panel.set_focus();
}

/// Brings the dashboard to the front; called from the menu bar panel.
#[tauri::command]
fn show_main(app: AppHandle) {
    show_main_window(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![BACKGROUND_ARG])))
        .manage(TrayState { hidden_at: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![load_db, save_db, data_dir, export_backup, show_main])
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "باز کردن داشبورد", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "خروج از دیده‌بان", true, Some("CmdOrCtrl+Q"))?;
            let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;
            TrayIconBuilder::with_id("main")
                .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true)
                .tooltip("دیده‌بان")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        toggle_tray_window(tray.app_handle());
                    }
                })
                .build(app)?;

            if std::env::args().any(|a| a == BACKGROUND_ARG) {
                if let Some(main) = app.get_webview_window("main") {
                    main.hide()?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the dashboard keeps the app alive in the menu bar so reminders keep working.
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "tray" => {
                if let Ok(mut t) = window.app_handle().state::<TrayState>().hidden_at.lock() {
                    *t = Some(Instant::now());
                }
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building Didebaan")
        .run(|_app, _event| {
            // Clicking the Dock icon while the dashboard is hidden brings it back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                show_main_window(_app);
            }
        });
}
