//! Poseidon Desktop — Tauri backend
//!
//! Epoch 3 / Spike 1: Hermes UI mount + gateway WS bridge.

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
use std::time::Duration;
use tauri::{Manager, RunEvent};

const BOOTSTRAP_JS: &str = include_str!("../../src/desktop-bridge/poseidon-bootstrap.js");

const BANNER_JS: &str = r#"(function(){
  if (document.getElementById('poseidon-boot-banner')) return;
  var b=document.createElement('div');
  b.id='poseidon-boot-banner';
  b.textContent='Poseidon bootstrap OK — hermesDesktop=' + !!window.hermesDesktop;
  b.style.cssText='position:fixed;z-index:2147483647;left:8px;bottom:8px;padding:6px 10px;background:#0e7499;color:#fff;font:12px monospace;border-radius:6px;opacity:0.9;pointer-events:none';
  (document.body||document.documentElement).appendChild(b);
  setTimeout(function(){ try{b.remove();}catch(e){} }, 8000);
})();"#;

fn inject_bootstrap(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if let Err(e) = w.eval(BOOTSTRAP_JS) {
            log::warn!("bootstrap eval: {}", e);
        } else {
            log::info!("Poseidon bootstrap injected");
        }
        let _ = w.eval(BANNER_JS);
    }
}

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
            gateway_ws_connect,
            gateway_ws_send,
            gateway_ws_close,
            gateway_ws_status,
            append_ui_log,
            get_ui_log_path,
        ])
        .setup(|app| {
            log::info!(
                "🔱 Poseidon Desktop v{} — Epoch 3 Spike 1",
                env!("CARGO_PKG_VERSION")
            );

            if let Some(w) = app.get_webview_window("main") {
                #[cfg(debug_assertions)]
                {
                    w.open_devtools();
                    log::info!("devtools opened (debug build)");
                }
            }

            // Inject now + delayed retries (Vite page may not be ready at setup)
            inject_bootstrap(app.handle());
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                for ms in [300_u64, 800, 1500, 3000] {
                    std::thread::sleep(Duration::from_millis(ms));
                    inject_bootstrap(&handle);
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Poseidon Desktop")
        .run(|app, event| {
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
