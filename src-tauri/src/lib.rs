//! Poseidon Desktop — Tauri backend

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
        .manage(Mutex::new(GatewayManager::new()))
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_platform,
            get_version,
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            open_external,
            open_path,
            quit_app,
            gateway_start,
            gateway_stop,
            gateway_status,
            show_open_dialog,
            show_save_dialog,
        ])
        .setup(|_app| {
            log::info!("🔱 Poseidon Desktop starting (v{})", env!("CARGO_PKG_VERSION"));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Poseidon Desktop");
}
