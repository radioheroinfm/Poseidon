//! Tauri commands, вызываемые из desktop-bridge.

use crate::gateway::{GatewayManager, GatewayStatus};
use crate::connection_state::{ActiveRoute, BootProgress, ConnectionInfo, ConnectionState};
use crate::ws_bridge::{WsBridge, WsOpenArgs, WsStatusEvent};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayWsUrlResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ws_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
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


/// Upstream-shaped: { ok, wsUrl } | { ok: false, error }
/// Local: hermes gateway ensure --json + session-ticket on gateway.sock
#[tauri::command]
pub async fn get_gateway_ws_url(
    _state: State<'_, Arc<GatewayManager>>,
) -> Result<GatewayWsUrlResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(unix)]
        {
            match crate::local_gateway::mint_local_ws_url() {
                Ok(ws_url) => Ok(GatewayWsUrlResult {
                    ok: true,
                    ws_url: Some(ws_url),
                    error: None,
                }),
                Err(e) => {
                    log::warn!("mint_local_ws_url: {}", e);
                    Ok(GatewayWsUrlResult {
                        ok: false,
                        ws_url: None,
                        error: Some(e),
                    })
                }
            }
        }
        #[cfg(not(unix))]
        {
            Ok(GatewayWsUrlResult {
                ok: false,
                ws_url: None,
                error: Some("local ticket mint not implemented on this OS yet".into()),
            })
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Run `hermes gateway ensure --json` and return parsed payload (debug / Spike 1).
#[tauri::command]
pub async fn gateway_ensure_json() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(unix)]
        {
            let payload = crate::local_gateway::gateway_ensure_json()?;
            serde_json::to_value(payload).map_err(|e| e.to_string())
        }
        #[cfg(not(unix))]
        {
            Err("gateway ensure --json only on unix for now".into())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}


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


// ---------------------------------------------------------------------------
// Connection (Epoch 3 P0 — ensure + route + boot)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_connection(
    conn: State<'_, Arc<ConnectionState>>,
) -> Result<ConnectionInfo, String> {
    let conn = Arc::clone(&conn);
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(unix)]
        {
            conn.set_boot(BootProgress {
                phase: "ensure".into(),
                ready: false,
                detail: Some("hermes gateway ensure --json".into()),
                percent: Some(30),
            });
            match crate::local_gateway::gateway_ensure_json() {
                Ok(payload) => {
                    let ep = payload.endpoint;
                    let (api_origin, instance_id, profile_id, code_sha, supervisor) = match &ep {
                        Some(e) => (
                            Some(e.api_origin.clone()),
                            Some(e.instance_id.clone()),
                            Some(e.profile_id.clone()),
                            e.code_sha.clone(),
                            e.supervisor.clone(),
                        ),
                        None => (None, None, None, None, None),
                    };
                    // Zhenya #8: do NOT mint ticket here (one-use, 30s).
                    // Mint only in get_gateway_ws_url / probe_gateway_ws.
                    // ensure --json already ran once above (mint_local_ws_url would ensure again).
                    let info = ConnectionInfo {
                        kind: if payload.state == "ready" {
                            "local".into()
                        } else {
                            "none".into()
                        },
                        state: payload.state,
                        api_origin,
                        instance_id,
                        profile_id,
                        ws_url: None,
                        code_sha,
                        supervisor,
                        message: payload.detail.map(|d| d.to_string()),
                    };
                    conn.set_last(info.clone());
                    conn.set_boot(BootProgress {
                        phase: if info.state == "ready" { "ready".into() } else { "ensure".into() },
                        ready: info.state == "ready",
                        detail: info.api_origin.clone(),
                        percent: Some(if info.state == "ready" { 90 } else { 40 }),
                    });
                    Ok(info)
                }
                Err(e) => {
                    let info = ConnectionInfo {
                        kind: "none".into(),
                        state: "error".into(),
                        message: Some(e.clone()),
                        ..ConnectionInfo::default()
                    };
                    conn.set_last(info.clone());
                    conn.set_boot(BootProgress {
                        phase: "error".into(),
                        ready: false,
                        detail: Some(e.clone()),
                        percent: Some(0),
                    });
                    Ok(info)
                }
            }
        }
        #[cfg(not(unix))]
        {
            Ok(ConnectionInfo {
                kind: "none".into(),
                state: "unsupported".into(),
                message: Some("local connection path is unix-only for now".into()),
                ..ConnectionInfo::default()
            })
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_active_connection_route(
    conn: State<'_, Arc<ConnectionState>>,
    route: ActiveRoute,
) -> Result<ActiveRoute, String> {
    conn.set_route(route.clone());
    Ok(route)
}

#[tauri::command]
pub async fn get_active_connection_route(
    conn: State<'_, Arc<ConnectionState>>,
) -> Result<ActiveRoute, String> {
    Ok(conn.get_route())
}

#[tauri::command]
pub async fn get_boot_progress(
    conn: State<'_, Arc<ConnectionState>>,
) -> Result<BootProgress, String> {
    Ok(conn.get_boot())
}

/// Rust-side WS probe (canonical subprotocols, no browser Origin).
#[tauri::command]
pub async fn probe_gateway_ws() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(unix)]
        {
            crate::local_gateway::probe_gateway_ws()
        }
        #[cfg(not(unix))]
        {
            Err("probe_gateway_ws is unix-only for now".into())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------------------
// ADR-015 / Kolyan D — multi-session WS (URL from renderer)
// ---------------------------------------------------------------------------


#[tauri::command]
pub async fn gateway_ws_open(
    app: AppHandle,
    bridge: State<'_, Arc<WsBridge>>,
    id: String,
    url: String,
    protocols: Option<Vec<String>>,
) -> Result<(), String> {
    let bridge = Arc::clone(&bridge);
    let args = WsOpenArgs { id, url, protocols };
    tauri::async_runtime::spawn_blocking(move || bridge.open(app, args))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gateway_ws_send(
    bridge: State<'_, Arc<WsBridge>>,
    text: String,
    id: Option<String>,
) -> Result<(), String> {
    let id = id.unwrap_or_else(|| "default".into());
    bridge.send(&id, text)
}

#[tauri::command]
pub async fn gateway_ws_close(
    bridge: State<'_, Arc<WsBridge>>,
    id: Option<String>,
    code: Option<u16>,
    reason: Option<String>,
) -> Result<WsStatusEvent, String> {
    let id = id.unwrap_or_else(|| "default".into());
    let _ = code;
    let _ = reason;
    bridge.close_id(&id)?;
    Ok(WsStatusEvent {
        id,
        connected: false,
        message: Some("disconnect requested".into()),
        protocol: None,
        code: Some(1000),
        was_clean: Some(true),
    })
}

/// Legacy single-session connect (mint URL in Rust) — kept for Probe button.
#[tauri::command]
pub async fn gateway_ws_connect(
    app: AppHandle,
    bridge: State<'_, Arc<WsBridge>>,
) -> Result<WsStatusEvent, String> {
    #[cfg(unix)]
    {
        let full = crate::local_gateway::mint_local_ws_url()?;
        // Parse ticket into protocols
        let ticket = full
            .split("ticket=")
            .nth(1)
            .and_then(|s| s.split('&').next())
            .ok_or_else(|| "no ticket in minted url".to_string())?;
        let dial = full.split("&ticket=").next().unwrap_or(&full).to_string();
        let dial = dial.split("?ticket=").next().unwrap_or(&dial).to_string();
        let id = "legacy-connect".to_string();
        let bridge = Arc::clone(&bridge);
        let args = WsOpenArgs {
            id: id.clone(),
            url: if dial.contains("native_dial") {
                dial
            } else {
                full.clone()
            },
            protocols: Some(vec![
                "hermes-gateway-v1".into(),
                format!("hermes-gateway-ticket.{}", ticket),
            ]),
        };
        tauri::async_runtime::spawn_blocking(move || bridge.open(app, args))
            .await
            .map_err(|e| e.to_string())??;
        Ok(WsStatusEvent {
            id,
            connected: true,
            message: Some("legacy connect started".into()),
            protocol: Some("hermes-gateway-v1".into()),
            code: None,
            was_clean: None,
        })
    }
    #[cfg(not(unix))]
    {
        let _ = (app, bridge);
        Err("unix only".into())
    }
}

#[tauri::command]
pub async fn gateway_ws_status(
    bridge: State<'_, Arc<WsBridge>>,
) -> Result<WsStatusEvent, String> {
    let _ = bridge;
    Ok(WsStatusEvent {
        id: "n/a".into(),
        connected: false,
        message: Some("use per-session events".into()),
        protocol: None,
        code: None,
        was_clean: None,
    })
}

// ---------------------------------------------------------------------------
// UI log file
// ---------------------------------------------------------------------------

fn ui_log_path() -> std::path::PathBuf {
    if let Ok(root) = std::env::var("POSEIDON_ROOT") {
        return std::path::PathBuf::from(root).join("logs").join("poseidon-ui.log");
    }
    let cwd = std::env::current_dir().unwrap_or_default();
    let mut dir = cwd.clone();
    for _ in 0..6 {
        if dir.join("package.json").exists() && dir.join("src-tauri").exists() {
            return dir.join("logs").join("poseidon-ui.log");
        }
        if !dir.pop() {
            break;
        }
    }
    dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".poseidon")
        .join("logs")
        .join("poseidon-ui.log")
}

#[tauri::command]
pub async fn append_ui_log(line: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let path = ui_log_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir {:?}: {}", parent, e))?;
        }
        // Soft size cap ~2 MiB: truncate by renaming aside
        if let Ok(meta) = std::fs::metadata(&path) {
            if meta.len() > 2 * 1024 * 1024 {
                let _ = std::fs::rename(&path, path.with_extension("log.old"));
            }
        }
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| format!("open {:?}: {}", path, e))?;
        // Never log lines that look like tickets
        let safe = if line.contains("ticket=") || line.contains("hermes-gateway-ticket.") {
            "[redacted ticket-like line]".to_string()
        } else {
            line
        };
        writeln!(f, "[{}] {}", ts, safe).map_err(|e| format!("write: {}", e))?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_ui_log_path() -> String {
    ui_log_path().to_string_lossy().to_string()
}
