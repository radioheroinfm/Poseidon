//! Poseidon Desktop — Tauri backend
//! Epoch 3 / Spike 1: Kolyan D — initialization_script + WebSocket shim

mod bridge;
mod gateway;
mod connection_state;
#[cfg(unix)]
mod local_gateway;
mod ws_bridge;

use bridge::*;
use gateway::GatewayManager;
use connection_state::ConnectionState;
use ws_bridge::WsBridge;
use std::sync::Arc;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

const BOOTSTRAP_JS: &str = include_str!("../../src/desktop-bridge/poseidon-bootstrap.js");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(GatewayManager::new()))
        .manage(Arc::new(ConnectionState::new()))
        .manage(Arc::new(WsBridge::new()))
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_platform,
            get_version,
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            show_open_dialog,
            show_save_dialog,
            open_external,
            open_path,
            quit_app,
            gateway_start,
            gateway_stop,
            gateway_status,
            get_gateway_ws_url,
            gateway_ensure,
            gateway_ensure_json,
            get_connection,
            set_active_connection_route,
            get_active_connection_route,
            get_boot_progress,
            probe_gateway_ws,
            gateway_ws_open,
            gateway_ws_connect,
            gateway_ws_send,
            gateway_ws_close,
            gateway_ws_status,
            append_ui_log,
            get_ui_log_path,
        ])
        .setup(|app| {
            log::info!(
                "🔱 Poseidon Desktop v{} — Spike 1 (Kolyan D)",
                env!("CARGO_PKG_VERSION")
            );

            let hermes_ui = std::env::var("POSEIDON_HERMES_UI").ok().as_deref() == Some("1");
            let dev_url = std::env::var("POSEIDON_DEV_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:5174".into());

            // Config-merge may still create "main" without initialization_script.
            // For Hermes UI: close it and recreate with init script BEFORE page JS.
            if hermes_ui {
                if let Some(w) = app.get_webview_window("main") {
                    log::info!("closing config-created main to re-open with initialization_script");
                    let _ = w.close();
                }
                let url = WebviewUrl::External(dev_url.parse().map_err(|e| format!("dev url: {}", e))?);
                let builder = WebviewWindowBuilder::new(app, "main", url)
                    .title("Poseidon — Hermes Desktop")
                    .inner_size(1280.0, 840.0)
                    .min_inner_size(900.0, 600.0)
                    .resizable(true)
                    .decorations(false)
                    .center()
                    .initialization_script(BOOTSTRAP_JS);
                let w = builder.build().map_err(|e| e.to_string())?;
                log::info!("main recreated with initialization_script → {}", dev_url);
                #[cfg(debug_assertions)]
                {
                    w.open_devtools();
                }
            } else if let Some(w) = app.get_webview_window("main") {
                let _ = w.eval(BOOTSTRAP_JS);
                #[cfg(debug_assertions)]
                {
                    w.open_devtools();
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Poseidon Desktop")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(bridge) = app.try_state::<Arc<WsBridge>>() {
                    bridge.close_all();
                }
                if let Some(state) = app.try_state::<Arc<GatewayManager>>() {
                    match state.stop() {
                        Ok(status) => log::info!("Exit cleanup: {:?}", status.message),
                        Err(e) => log::warn!("Exit cleanup error: {}", e),
                    }
                }
            }
        });
}
