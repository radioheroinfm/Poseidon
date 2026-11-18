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
use tauri::{Manager, RunEvent};
use tauri::webview::PageLoadEvent;

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
                // Re-inject after every full page load (Vite HMR / first navigation)
                let w_for_load = w.clone();
                let _ = w_for_load.on_page_load(move |window, payload| {
                    match payload.event() {
                        PageLoadEvent::Finished => {
                            log::info!("page load finished — injecting bootstrap");
                            if let Err(e) = window.eval(BOOTSTRAP_JS) {
                                log::warn!("bootstrap eval: {}", e);
                            }
                            // Visible banner so white screen ≠ silent failure
                            let _ = window.eval(
                                r#"(function(){
                                  if (document.getElementById('poseidon-boot-banner')) return;
                                  var b=document.createElement('div');
                                  b.id='poseidon-boot-banner';
                                  b.textContent='Poseidon bootstrap OK — hermesDesktop=' + !!window.hermesDesktop;
                                  b.style.cssText='position:fixed;z-index:2147483647;left:8px;bottom:8px;padding:6px 10px;background:#0e7499;color:#fff;font:12px monospace;border-radius:6px;opacity:0.9;pointer-events:none';
                                  document.documentElement.appendChild(b);
                                  setTimeout(function(){ try{b.remove();}catch(e){} }, 8000);
                                })();"#
                            );
                        }
                        _ => {}
                    }
                });

                // First inject (may be early — page-load will repeat)
                if let Err(e) = w.eval(BOOTSTRAP_JS) {
                    log::warn!("early bootstrap eval: {}", e);
                }

                #[cfg(debug_assertions)]
                {
                    w.open_devtools();
                    log::info!("devtools opened (debug build)");
                }
            }
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
