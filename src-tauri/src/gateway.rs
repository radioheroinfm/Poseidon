//! GatewayManager — управление жизненным циклом Python-процесса `hermes serve`
//!
//! Политика владения (ADR-009):
//! - Убиваем Gateway только если сами его запустили (`owned_by_us = true`).
//! - Если обнаружили уже работающий — только attach, при выходе не трогаем.

use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use log::{info, warn, error};

/// Порт по умолчанию, на котором Hermes Gateway обычно слушает.
/// TODO: сделать конфигурируемым и читать из реальных настроек Hermes.
const DEFAULT_GATEWAY_PORT: u16 = 8642;

#[derive(Debug, Clone, serde::Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub owned_by_us: bool,
    /// true = мы видим, что порт слушается (даже если процесс не наш)
    pub port_open: bool,
}

pub struct GatewayManager {
    child: Mutex<Option<Child>>,
    owned_by_us: Mutex<bool>,
    port: u16,
}

impl GatewayManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            owned_by_us: Mutex::new(false),
            port: DEFAULT_GATEWAY_PORT,
        }
    }

    /// Проверяет, открыт ли порт Gateway (простой TCP connect).
    fn is_port_open(&self) -> bool {
        TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", self.port).parse().unwrap(),
            Duration::from_millis(120),
        )
        .is_ok()
    }

    /// Пытается запустить Gateway. Если порт уже слушается — attach.
    pub fn start(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;

        // 1. У нас уже есть живой owned-процесс?
        if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    info!("Gateway already owned and running (pid={})", child.id());
                    return Ok(GatewayStatus {
                        running: true,
                        pid: Some(child.id()),
                        owned_by_us: true,
                        port_open: self.is_port_open(),
                    });
                }
                Ok(Some(status)) => {
                    warn!("Previously owned gateway exited with {:?}", status);
                    *child_guard = None;
                    *owned_guard = false;
                }
                Err(e) => {
                    error!("Error checking owned gateway: {}", e);
                    *child_guard = None;
                    *owned_guard = false;
                }
            }
        }

        // 2. Порт уже кем-то слушается? → attach mode
        if self.is_port_open() {
            info!(
                "Gateway port {} is already open — attaching (will not kill on exit)",
                self.port
            );
            *owned_guard = false;
            return Ok(GatewayStatus {
                running: true,
                pid: None, // мы не знаем pid чужого процесса (пока)
                owned_by_us: false,
                port_open: true,
            });
        }

        // 3. Реальный запуск (пока честная заглушка)
        info!("No gateway detected on port {}. Real spawn is not implemented yet (TODO)", self.port);

        // Будущий код:
        // let child = Command::new("hermes")
        //     .arg("serve")
        //     .stdout(Stdio::null())
        //     .stderr(Stdio::null())
        //     .spawn()
        //     .map_err(|e| format!("Failed to start hermes serve: {}", e))?;
        // let pid = child.id();
        // *child_guard = Some(child);
        // *owned_guard = true;

        Ok(GatewayStatus {
            running: false,
            pid: None,
            owned_by_us: false,
            port_open: false,
        })
    }

    /// Останавливает Gateway только если он принадлежит нам.
    pub fn stop(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;

        if !*owned_guard {
            info!("stop() called, but gateway is not owned by us — doing nothing");
            return Ok(GatewayStatus {
                running: self.is_port_open(),
                pid: None,
                owned_by_us: false,
                port_open: self.is_port_open(),
            });
        }

        if let Some(mut child) = child_guard.take() {
            info!("Stopping owned gateway (pid={})", child.id());
            // TODO: graceful SIGTERM
            std::thread::sleep(Duration::from_millis(300));
            match child.try_wait() {
                Ok(Some(_)) => info!("Gateway exited"),
                _ => {
                    warn!("Gateway did not exit in time, killing");
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }

        *owned_guard = false;

        Ok(GatewayStatus {
            running: false,
            pid: None,
            owned_by_us: false,
            port_open: self.is_port_open(),
        })
    }

    pub fn status(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;
        let port_open = self.is_port_open();

        let (running, pid) = if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(None) => (true, Some(child.id())),
                _ => {
                    *child_guard = None;
                    (port_open, None)
                }
            }
        } else {
            (port_open, None)
        };

        Ok(GatewayStatus {
            running,
            pid,
            owned_by_us: *owned_guard,
            port_open,
        })
    }
}

impl Drop for GatewayManager {
    fn drop(&mut self) {
        if let Ok(owned) = self.owned_by_us.lock() {
            if *owned {
                info!("GatewayManager dropped — stopping owned gateway");
                let _ = self.stop();
            }
        }
    }
}
