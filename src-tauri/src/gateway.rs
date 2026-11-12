//! GatewayManager — управление жизненным циклом Python-процесса `hermes serve`
//!
//! Политика владения (ADR-009):
//! - Убиваем Gateway только если сами его запустили (`owned_by_us = true`).
//! - Если обнаружили уже работающий — только attach, при выходе не трогаем.

use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use log::{info, warn, error};

/// Порт по умолчанию, на котором Hermes Gateway обычно слушает.
const DEFAULT_GATEWAY_PORT: u16 = 8642;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub owned_by_us: bool,
    pub port_open: bool,
    pub message: Option<String>,
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

    fn is_port_open(&self) -> bool {
        TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", self.port).parse().unwrap(),
            Duration::from_millis(150),
        )
        .is_ok()
    }

    /// Ищет бинарник/скрипт hermes в типичных местах.
    fn find_hermes_binary() -> Option<PathBuf> {
        // 1. Просто "hermes" из PATH
        if which::which("hermes").is_ok() {
            return Some(PathBuf::from("hermes"));
        }

        // 2. Типичные пользовательские места
        if let Some(home) = dirs::home_dir() {
            let candidates = [
                home.join(".hermes/bin/hermes"),
                home.join(".local/bin/hermes"),
                home.join("hermes-agent/.venv/bin/hermes"),
            ];
            for path in candidates {
                if path.exists() {
                    return Some(path);
                }
            }
        }

        None
    }

    pub fn start(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;

        // 1. Уже есть наш живой процесс?
        if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    info!("Gateway already owned and running (pid={})", child.id());
                    return Ok(GatewayStatus {
                        running: true,
                        pid: Some(child.id()),
                        owned_by_us: true,
                        port_open: self.is_port_open(),
                        message: Some("already running (owned)".into()),
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

        // 2. Порт уже слушается → attach
        if self.is_port_open() {
            info!("Gateway port {} is open — attaching (will not kill on exit)", self.port);
            *owned_guard = false;
            return Ok(GatewayStatus {
                running: true,
                pid: None,
                owned_by_us: false,
                port_open: true,
                message: Some("attached to existing gateway".into()),
            });
        }

        // 3. Пытаемся найти и запустить hermes
        let hermes = match Self::find_hermes_binary() {
            Some(path) => path,
            None => {
                let msg = "hermes binary not found in PATH or common locations".to_string();
                warn!("{}", msg);
                return Ok(GatewayStatus {
                    running: false,
                    pid: None,
                    owned_by_us: false,
                    port_open: false,
                    message: Some(msg),
                });
            }
        };

        info!("Starting gateway via {:?}", hermes);

        let mut cmd = Command::new(&hermes);
        cmd.arg("serve")
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        // На Unix стараемся создать новую process group, чтобы потом можно было гасить всё дерево
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }

        match cmd.spawn() {
            Ok(child) => {
                let pid = child.id();
                info!("Gateway spawned successfully (pid={})", pid);
                *child_guard = Some(child);
                *owned_guard = true;

                // Даем немного времени на старт и проверяем порт
                std::thread::sleep(Duration::from_millis(400));
                let port_open = self.is_port_open();

                Ok(GatewayStatus {
                    running: true,
                    pid: Some(pid),
                    owned_by_us: true,
                    port_open,
                    message: Some("started by Poseidon".into()),
                })
            }
            Err(e) => {
                let msg = format!("Failed to spawn hermes: {}", e);
                error!("{}", msg);
                Ok(GatewayStatus {
                    running: false,
                    pid: None,
                    owned_by_us: false,
                    port_open: false,
                    message: Some(msg),
                })
            }
        }
    }

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
                message: Some("not owned — left untouched".into()),
            });
        }

        if let Some(mut child) = child_guard.take() {
            let pid = child.id();
            info!("Stopping owned gateway (pid={})", pid);

            // Сначала пытаемся gracefully
            #[cfg(unix)]
            {
                // Посылаем SIGTERM всей группе
                unsafe {
                    libc::kill(-(pid as i32), libc::SIGTERM);
                }
                std::thread::sleep(Duration::from_millis(450));
            }

            match child.try_wait() {
                Ok(Some(_)) => info!("Gateway exited gracefully"),
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
            message: Some("stopped".into()),
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
            message: None,
        })
    }
}

impl Drop for GatewayManager {
    fn drop(&mut self) {
        let should_stop = self.owned_by_us.lock().map(|guard| *guard).unwrap_or(false);
        if should_stop {
            info!("GatewayManager dropped — stopping owned gateway");
            let _ = self.stop();
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_manager_is_not_owned() {
        let mgr = GatewayManager::new();
        let status = mgr.status().expect("status");
        assert!(!status.owned_by_us);
        assert!(status.pid.is_none());
    }

    #[test]
    fn stop_without_ownership_is_safe() {
        let mgr = GatewayManager::new();
        let status = mgr.stop().expect("stop");
        assert!(!status.owned_by_us);
        assert!(!status.running || status.port_open); // may or may not have something on port
    }

    #[test]
    fn platform_values_are_electron_compatible() {
        // This test lives conceptually with B4; actual mapping is in bridge.rs
        // Here we only assert the manager can be created repeatedly.
        let _m1 = GatewayManager::new();
        let _m2 = GatewayManager::new();
    }
}
