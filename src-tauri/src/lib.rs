//! Poseidon Desktop — Tauri backend
//!
//! Архитектурные принципы:
//! - Красота и честность
//! - Изоморфный bridge (React почти ничего не замечает)
//! - Жёсткий контроль lifecycle Python Gateway

mod bridge;
mod gateway;

use bridge::*;
use gateway::GatewayManager;
use tauri::Manager;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(GatewayManager::new()))
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
            // Shell
            open_external,
            open_path,
            // App
            quit_app,
            // Gateway
            gateway_start,
            gateway_stop,
            gateway_status,
        ])
        .setup(|app| {
            log::info!("🔱 Poseidon Desktop starting (v{})", env!("CARGO_PKG_VERSION"));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Poseidon Desktop");
}
