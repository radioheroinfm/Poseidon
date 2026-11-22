//! Tauri commands, вызываемые из desktop-bridge.

use crate::gateway::{GatewayManager, GatewayStatus};
use crate::connection_state::{ActiveRoute, BootProgress, ConnectionInfo, ConnectionState};
use crate::ws_bridge::{Emit, WsBridge, WsEvent, WsStatus, LEGACY_ID};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayWsUrlResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ws_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
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
    bridge: State<'_, Arc<WsBridge>>,
) -> Result<GatewayWsUrlResult, String> {
    let bridge = Arc::clone(&bridge);
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(unix)]
        {
            match crate::local_gateway::mint_local_ws_url() {
                Ok(ws_url) => {
                    if let Some(port) = crate::ws_bridge::ws_url_port(&ws_url) {
                        bridge.allow_port(port);
                    }
                    Ok(GatewayWsUrlResult {
                        ok: true,
                        ws_url: Some(ws_url),
                        error: None,
                    })
                }
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
    bridge: State<'_, Arc<WsBridge>>,
) -> Result<ConnectionInfo, String> {
    let conn = Arc::clone(&conn);
    let bridge = Arc::clone(&bridge);
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(unix)]
        {
            // Always run ensure --json so api_origin stays current after gateway restart.
            // (Ready-cache hid dead ports → REST Unauthorized / connection refused.)
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
                    let origin = api_origin.clone();
                    let info = ConnectionInfo {
                        kind: if payload.state == "ready" {
                            "local".into()
                        } else {
                            "none".into()
                        },
                        state: payload.state.clone(),
                        mode: "local".into(),
                        api_origin: origin.clone(),
                        base_url: origin,
                        instance_id,
                        profile_id,
                        profile: Some("default".into()),
                        connection_id: Some("local".into()),
                        ws_url: None,
                        code_sha,
                        supervisor,
                        auth_mode: Some("native".into()),
                        token: Some(String::new()),
                        message: payload.detail.map(|d| d.to_string()),
                    };
                    conn.set_last(info.clone());
                    if let Some(ref origin) = info.api_origin {
                        if let Some(port) = origin.rsplit(':').next().and_then(|s| s.parse::<u16>().ok()) {
                            bridge.allow_port(port);
                        }
                    }
                    conn.set_boot(BootProgress {
                        phase: if info.state == "ready" { "ready".into() } else { "ensure".into() },
                        ready: info.state == "ready",
                        detail: info.api_origin.clone().or(Some("ensure done".into())),
                        percent: Some(if info.state == "ready" { 100 } else { 40 }),
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
// ADR-015 / Kolyan patch-01 — multi-session WS (URL from renderer)
// ---------------------------------------------------------------------------

fn make_emitter(app: AppHandle) -> Emit {
    Arc::new(move |ev: WsEvent| {
        match ev {
            WsEvent::Frame { id, data } => {
                let _ = app.emit(
                    "gateway-ws-session-frame",
                    serde_json::json!({ "id": id, "data": data }),
                );
                // legacy alias for placeholder smoke
                let _ = app.emit("gateway-ws-frame", data);
            }
            WsEvent::Status {
                id,
                connected,
                message,
                code,
            } => {
                let _ = app.emit(
                    "gateway-ws-session-status",
                    serde_json::json!({
                        "id": id,
                        "connected": connected,
                        "message": message,
                        "code": code,
                    }),
                );
                let _ = app.emit(
                    "gateway-ws-status",
                    WsStatus {
                        connected,
                        message,
                    },
                );
            }
        }
    })
}

#[tauri::command]
pub async fn gateway_ws_open(
    app: AppHandle,
    bridge: State<'_, Arc<WsBridge>>,
    id: String,
    url: String,
    protocols: Option<Vec<String>>,
) -> Result<WsStatus, String> {
    let protocols = protocols.unwrap_or_default();
    let bridge = Arc::clone(&bridge);
    tauri::async_runtime::spawn_blocking(move || {
        bridge.open(make_emitter(app), &id, &url, &protocols)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gateway_ws_send(
    bridge: State<'_, Arc<WsBridge>>,
    text: String,
    id: Option<String>,
) -> Result<(), String> {
    let id = id.unwrap_or_else(|| LEGACY_ID.to_string());
    bridge.send_to(&id, text)
}

#[tauri::command]
pub async fn gateway_ws_close(
    bridge: State<'_, Arc<WsBridge>>,
    id: Option<String>,
    code: Option<u16>,
    reason: Option<String>,
) -> Result<WsStatus, String> {
    let _ = (code, reason);
    let id = id.unwrap_or_else(|| LEGACY_ID.to_string());
    bridge.close_id(&id)
}

#[tauri::command]
pub async fn gateway_ws_connect(
    app: AppHandle,
    bridge: State<'_, Arc<WsBridge>>,
) -> Result<WsStatus, String> {
    let bridge = Arc::clone(&bridge);
    tauri::async_runtime::spawn_blocking(move || -> Result<WsStatus, String> {
        #[cfg(unix)]
        {
            let full = crate::local_gateway::mint_local_ws_url()?;
            let (dial_url, ticket) = crate::ws_bridge::parse_ticket_url(&full)?;
            if let Some(port) = crate::ws_bridge::ws_url_port(&dial_url) {
                bridge.allow_port(port);
            }
            let protocols = vec![
                "hermes-gateway-v1".to_string(),
                format!("hermes-gateway-ticket.{}", ticket),
            ];
            bridge.open(make_emitter(app), LEGACY_ID, &dial_url, &protocols)
        }
        #[cfg(not(unix))]
        {
            let _ = (&app, &bridge);
            Err("ws_bridge legacy connect is unix-only for now".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gateway_ws_status(
    bridge: State<'_, Arc<WsBridge>>,
) -> Result<WsStatus, String> {
    Ok(WsStatus {
        connected: bridge.is_connected(),
        message: Some(if bridge.is_connected() {
            "legacy session open".into()
        } else {
            "no legacy session".into()
        }),
    })
}



// ---------------------------------------------------------------------------
// hermesDesktop.api — Electron-compatible REST proxy (renderer never fetches)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HermesApiRequest {
    pub path: String,
    pub method: Option<String>,
    pub body: Option<serde_json::Value>,
    pub connection_id: Option<String>,
    pub profile: Option<String>,
    pub priority: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[tauri::command]
pub async fn hermes_api(request: HermesApiRequest) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(unix)]
        {
            hermes_api_local(request)
        }
        #[cfg(not(unix))]
        {
            let _ = request;
            Err("hermes_api is unix-only for now".into())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(unix)]
fn hermes_api_local(request: HermesApiRequest) -> Result<serde_json::Value, String> {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    let ensure = crate::local_gateway::gateway_ensure_json()?;
    let ep = ensure
        .endpoint
        .ok_or_else(|| "ensure returned no endpoint".to_string())?;
    let origin = ep.api_origin.trim_end_matches('/').to_string();
    // origin like http://127.0.0.1:55555
    let url_path = if request.path.starts_with('/') {
        request.path.clone()
    } else {
        format!("/{}", request.path)
    };
    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_uppercase();

    // Mint session ticket (same control plane as WS)
    let ticket = crate::local_gateway::mint_session_ticket_for(&ep.instance_id, &ep.profile_id, "native-http")?;

    // Parse host:port from origin
    let without = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
        .ok_or_else(|| format!("bad api_origin {}", origin))?;
    let host_port = without.split('/').next().unwrap_or(without);
    let (host, port): (&str, u16) = if let Some((h, p)) = host_port.rsplit_once(':') {
        (h, p.parse().map_err(|_| format!("bad port in {}", origin))?)
    } else {
        (host_port, 80)
    };

    let body_str = request
        .body
        .as_ref()
        .map(|b| serde_json::to_string(b).unwrap_or_else(|_| "{}".into()));

    // Try several auth presentations; Electron main uses a private ticket channel.
    let auth_attempts: Vec<(String, String)> = vec![
        // Electron native HTTP grant (local-gateway.ts → X-Hermes-Gateway-Ticket)
        (
            "X-Hermes-Gateway-Ticket".into(),
            format!("X-Hermes-Gateway-Ticket: {}\r\n", ticket),
        ),
        (
            "X-Hermes-Session-Token".into(),
            format!("X-Hermes-Session-Token: {}\r\n", ticket),
        ),
        (
            "Authorization Bearer".into(),
            format!("Authorization: Bearer {}\r\n", ticket),
        ),
    ];

    let mut last_err = String::from("no auth attempt succeeded");
    for (label, auth_header) in auth_attempts {
        let path_q = if label == "query ticket" {
            let sep = if url_path.contains('?') { "&" } else { "?" };
            format!("{}{}ticket={}", url_path, sep, ticket)
        } else {
            url_path.clone()
        };
        let mut req = format!(
            "{} {} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nConnection: close\r\n{}",
            method, path_q, host_port, auth_header
        );
        if let Some(ref profile) = request.profile {
            if !profile.is_empty() {
                req.push_str(&format!("X-Hermes-Profile: {}\r\n", profile));
            }
        }
        if let Some(ref b) = body_str {
            req.push_str("Content-Type: application/json\r\n");
            req.push_str(&format!("Content-Length: {}\r\n", b.len()));
        }
        req.push_str("\r\n");
        if let Some(ref b) = body_str {
            req.push_str(b);
        }

        let mut stream = match TcpStream::connect(format!("{}:{}", host, port)) {
            Ok(s) => s,
            Err(e) => {
                last_err = format!("connect {}:{}: {}", host, port, e);
                continue;
            }
        };
        stream.set_read_timeout(Some(Duration::from_secs(60))).ok();
        stream.set_write_timeout(Some(Duration::from_secs(15))).ok();
        if let Err(e) = stream.write_all(req.as_bytes()) {
            last_err = format!("write: {}", e);
            continue;
        }
        let mut buf = Vec::new();
        if let Err(e) = stream.read_to_end(&mut buf) {
            last_err = format!("read: {}", e);
            continue;
        }
        let text = String::from_utf8_lossy(&buf);
        let body = text
            .split("\r\n\r\n")
            .nth(1)
            .or_else(|| text.split("\n\n").nth(1))
            .unwrap_or("")
            .trim()
            .to_string();
        let status_line = text.lines().next().unwrap_or("").to_string();
        if status_line.contains(" 401 ") || status_line.contains(" 403 ") {
            last_err = format!("auth {} -> {} body={}", label, status_line, &body[..body.len().min(120)]);
            continue;
        }
        if body.is_empty() {
            last_err = format!("empty body with {}", label);
            continue;
        }
        match serde_json::from_str::<serde_json::Value>(&body) {
            Ok(v) => {
                log::info!("hermes_api OK via {}", label);
                return Ok(v);
            }
            Err(e) => {
                last_err = format!("JSON {} via {}: {}", e, label, &body[..body.len().min(200)]);
                continue;
            }
        }
    }
    Err(format!("hermes_api unauthorized: {}", last_err))
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
