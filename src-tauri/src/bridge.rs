//! Tauri commands, вызываемые из desktop-bridge.

use crate::gateway::{GatewayManager, GatewayStatus};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_dialog::{DialogExt, FilePath};
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub tauri_version: String,
    pub is_tauri: bool,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub directory: Option<bool>,
    pub multiple: Option<bool>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        platform: get_platform(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        is_tauri: true,
    }
}

#[tauri::command]
pub fn get_platform() -> String {
    match std::env::consts::OS {
        "macos" => "darwin".to_string(),
        "windows" => "win32".to_string(),
        other => other.to_string(),
    }
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
// Dialogs
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn show_open_dialog<R: Runtime>(
    app: AppHandle<R>,
    options: Option<OpenDialogOptions>,
) -> Result<Option<Vec<String>>, String> {
    let mut builder = app.dialog().file();

    // Read flags before moving fields out of options
    let is_dir = options.as_ref().and_then(|o| o.directory).unwrap_or(false);
    let multiple = options.as_ref().and_then(|o| o.multiple).unwrap_or(false);

    if let Some(opts) = options {
        if let Some(title) = opts.title {
            builder = builder.set_title(title);
        }
        if let Some(default_path) = opts.default_path {
            builder = builder.set_directory(default_path);
        }
    }

    if is_dir {
        let result = builder.blocking_pick_folder();
        Ok(result.map(|path: FilePath| vec![path.to_string()]))
    } else if multiple {
        let result = builder.blocking_pick_files();
        Ok(result.map(|paths| {
            paths.into_iter().map(|p: FilePath| p.to_string()).collect()
        }))
    } else {
        let result = builder.blocking_pick_file();
        Ok(result.map(|path: FilePath| vec![path.to_string()]))
    }
}

#[tauri::command]
pub async fn show_save_dialog<R: Runtime>(
    app: AppHandle<R>,
    options: Option<SaveDialogOptions>,
) -> Result<Option<String>, String> {
    let mut builder = app.dialog().file();

    if let Some(opts) = options {
        if let Some(title) = opts.title {
            builder = builder.set_title(title);
        }
        if let Some(default_path) = opts.default_path {
            builder = builder.set_file_name(default_path);
        }
    }

    let result = builder.blocking_save_file();

    Ok(result.map(|path: FilePath| path.to_string()))
}

// ---------------------------------------------------------------------------
// Shell (with validation — ADR Security)
// ---------------------------------------------------------------------------

/// Разрешаем только http/https/mailto для внешних ссылок.
fn validate_external_url(url: &str) -> Result<(), String> {
    let lower = url.trim().to_lowercase();
    if lower.starts_with("https://")
        || lower.starts_with("http://")
        || lower.starts_with("mailto:")
    {
        Ok(())
    } else {
        Err(format!(
            "open_external: blocked URL scheme (only http/https/mailto allowed): {}",
            url
        ))
    }
}

/// Блокируем опасные схемы и пустые пути.
fn validate_open_path(path: &str) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("open_path: empty path".into());
    }
    let lower = trimmed.to_lowercase();
    // Block URL-like schemes. "javascript:foo" has no "://".
    // Only treat as scheme if prefix is [a-z][a-z0-9+.-]* and does not contain '/'.
    // This allows paths like "/tmp/12:30.txt".
    if let Some(idx) = lower.find(':') {
        let scheme = &lower[..idx];
        let is_scheme = !scheme.is_empty()
            && !scheme.contains('/')
            && scheme
                .chars()
                .enumerate()
                .all(|(i, c)| {
                    if i == 0 {
                        c.is_ascii_alphabetic()
                    } else {
                        c.is_ascii_alphanumeric() || c == '+' || c == '.' || c == '-'
                    }
                });
        if is_scheme {
            let is_windows_drive = scheme.len() == 1;
            if !is_windows_drive && scheme != "file" {
                return Err(format!(
                    "open_path: blocked path with scheme '{}': {}",
                    scheme, path
                ));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn open_external(url: String) -> Result<(), String> {
    validate_external_url(&url)?;
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    validate_open_path(&path)?;
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
// Gateway
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn gateway_start(
    state: State<'_, Arc<GatewayManager>>,
) -> Result<GatewayStatus, String> {
    let mgr = Arc::clone(&state);
    tauri::async_runtime::spawn_blocking(move || mgr.start())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gateway_stop(
    state: State<'_, Arc<GatewayManager>>,
) -> Result<GatewayStatus, String> {
    state.stop()
}

#[tauri::command]
pub async fn gateway_status(
    state: State<'_, Arc<GatewayManager>>,
) -> Result<GatewayStatus, String> {
    state.status()
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_url_allows_http_https_mailto() {
        assert!(validate_external_url("https://example.com").is_ok());
        assert!(validate_external_url("http://localhost:8642").is_ok());
        assert!(validate_external_url("mailto:a@b.com").is_ok());
    }

    #[test]
    fn external_url_blocks_dangerous_schemes() {
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("file:///etc/passwd").is_err());
        assert!(validate_external_url("data:text/html,hi").is_err());
    }

    #[test]
    fn open_path_rejects_empty_and_schemes() {
        assert!(validate_open_path("").is_err());
        assert!(validate_open_path("javascript:foo").is_err());
        assert!(validate_open_path("data:text/html,hi").is_err());
        assert!(validate_open_path("http://example.com").is_err());
        assert!(validate_open_path("/tmp/test.txt").is_ok());
        assert!(validate_open_path("/tmp/12:30.txt").is_ok()); // colon in filename
        assert!(validate_open_path("C:\\Users\\test").is_ok()); // Windows drive
    }
}


/// WS URL for renderer (Epoch 3 P0). Null if gateway not up.
#[tauri::command]
pub async fn get_gateway_ws_url(
    state: State<'_, Arc<GatewayManager>>,
) -> Result<Option<String>, String> {
    let st = state.status()?;
    if st.port_open {
        if let Some(port) = st.port {
            return Ok(Some(format!("ws://127.0.0.1:{}", port)));
        }
    }
    Ok(None)
}

/// Ensure gateway is running; return status + ws URL for Spike 1 boot.
#[tauri::command]
pub async fn gateway_ensure(
    state: State<'_, Arc<GatewayManager>>,
) -> Result<GatewayStatus, String> {
    let mgr = Arc::clone(&state);
    tauri::async_runtime::spawn_blocking(move || {
        let st = mgr.status()?;
        if st.running && st.port_open {
            return Ok(st);
        }
        mgr.start()
    })
    .await
    .map_err(|e| e.to_string())?
}
