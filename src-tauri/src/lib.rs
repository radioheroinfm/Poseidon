//! Poseidon Desktop — Tauri backend
//!
//! Epoch 2: buildable foundation + upstream-aligned gateway lifecycle.

mod bridge;
mod gateway;
#[cfg(unix)]
mod local_gateway;

use bridge::*;
use gateway::GatewayManager;
use std::sync::Arc;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(GatewayManager::new()))
        .invoke_handler(tauri::generate_handler![
            // System
            get_system_info,
            get_platform,
            get_version,
            // Window
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            // Dialogs
            show_open_dialog,
            show_save_dialog,
            // Shell
            open_external,
            open_path,
            // App
            quit_app,
            // Gateway
            gateway_start,
            gateway_stop,
            gateway_status,
            get_gateway_ws_url,
            gateway_ensure,
            gateway_ensure_json,
        ])
        .setup(|_app| {
            log::info!(
                "🔱 Poseidon Desktop v{} — Epoch 2",
                env!("CARGO_PKG_VERSION")
            );
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Poseidon Desktop")
        .run(|app, event| {
            // On exit: stop only the gateway we own (ADR-009)
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<Arc<GatewayManager>>() {
                    match state.stop() {
                        Ok(status) => log::info!("Exit cleanup: {:?}", status.message),
                        Err(e) => log::warn!("Exit cleanup error: {}", e),
                    }
                }
            }
        });
}
