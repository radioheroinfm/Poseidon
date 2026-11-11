//! Tauri commands, которые вызываются из desktop-bridge.

use crate::gateway::{GatewayManager, GatewayStatus};
use tauri::{AppHandle, Manager, Runtime, State};
use serde::Serialize;
use std::sync::Mutex;

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub tauri_version: String,
    pub is_tauri: bool,
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        is_tauri: true,
    }
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ---------------------------------------------------------------------------
// Window controls
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn window_minimize<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn window_maximize<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().map_err(|e| e.to_string())? {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn window_close<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn window_is_maximized<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        window.is_maximized().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn quit_app<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

// ---------------------------------------------------------------------------
// Gateway — теперь с политикой владения
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn gateway_start(
    state: State<'_, Mutex<GatewayManager>>,
) -> Result<GatewayStatus, String> {
    let mgr = state.lock().map_err(|e| e.to_string())?;
    mgr.start()
}

#[tauri::command]
pub async fn gateway_stop(
    state: State<'_, Mutex<GatewayManager>>,
) -> Result<GatewayStatus, String> {
    let mgr = state.lock().map_err(|e| e.to_string())?;
    mgr.stop()
}

#[tauri::command]
pub async fn gateway_status(
    state: State<'_, Mutex<GatewayManager>>,
) -> Result<GatewayStatus, String> {
    let mgr = state.lock().map_err(|e| e.to_string())?;
    mgr.status()
}


// ---------------------------------------------------------------------------
// Dialogs (Безопасные обработчики до подключения tauri-plugin-dialog)
// ---------------------------------------------------------------------------
#[tauri::command]
pub async fn show_open_dialog(
    _options: Option<serde_json::Value>,
) -> Result<Option<Vec<String>>, String> {
    log::info!("show_open_dialog called (dialog plugin will be linked in next phase)");
    Ok(None)
}

#[tauri::command]
pub async fn show_save_dialog(
    _options: Option<serde_json::Value>,
) -> Result<Option<String>, String> {
    log::info!("show_save_dialog called (dialog plugin will be linked in next phase)");
    Ok(None)
}
