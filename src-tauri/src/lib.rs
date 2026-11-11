//! Poseidon Desktop — Tauri backend
//!
//! Эпоха 1: фундамент оболочки.

mod bridge;
mod gateway;

use bridge::*;
use gateway::GatewayManager;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
        ])
        .setup(|_app| {
            log::info!("🔱 Poseidon Desktop v{} — Epoch 1 foundation ready", env!("CARGO_PKG_VERSION"));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Poseidon Desktop");
}
