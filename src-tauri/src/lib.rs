//! Poseidon Desktop — Tauri backend
//! 
//! Главный принцип: красота + честность.
//! Здесь живёт нативная часть: окна, lifecycle Gateway, bridge commands.

mod gateway;
mod bridge;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // TODO: здесь будет инициализация bridge и gateway manager
            log::info!("Poseidon Desktop starting...");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Poseidon Desktop");
}
