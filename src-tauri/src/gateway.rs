//! GatewayManager — управление жизненным циклом Python-процесса `hermes serve`
//!
//! Политика владения (ADR-009):
//! - Мы убиваем Gateway только если сами его запустили в этой сессии (`owned_by_us = true`).
//! - Если обнаружили уже работающий Gateway — только подключаемся (attach) и при выходе не трогаем.
//! - Это защищает сессии CLI / ботов / cron от случайного убийства.

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use log::{info, warn, error};

#[derive(Debug, Clone, serde::Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub owned_by_us: bool,
}

pub struct GatewayManager {
    /// Дочерний процесс, если мы его запустили
    child: Mutex<Option<Child>>,
    /// true = мы запустили этот процесс и имеем право его убить
    owned_by_us: Mutex<bool>,
}

impl GatewayManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            owned_by_us: Mutex::new(false),
        }
    }

    /// Пытается запустить Gateway. Если уже запущен кем-то — просто attach.
    pub fn start(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;

        // 1. Если у нас уже есть живой owned-процесс — ничего не делаем
        if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    info!("Gateway already owned and running (pid={})", child.id());
                    return Ok(GatewayStatus {
                        running: true,
                        pid: Some(child.id()),
                        owned_by_us: true,
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

        // 2. TODO: Здесь должна быть проверка "а не слушает ли уже кто-то порт Gateway"
        //    Пока честно говорим, что реальный discover/attach ещё не реализован.
        //    Когда появится — если Gateway уже жив, мы просто вернём running=true, owned_by_us=false.

        // 3. Запуск нового процесса (пока заглушка)
        info!("Gateway start requested — real spawn not yet implemented (honest TODO)");

        // Будущий код:
        // let child = Command::new("hermes")
        //     .arg("serve")
        //     .stdout(Stdio::null())
        //     .stderr(Stdio::null())
        //     .spawn()
        //     .map_err(|e| format!("Failed to start hermes serve: {}", e))?;
        //
        // let pid = child.id();
        // *child_guard = Some(child);
        // *owned_guard = true;
        //
        // return Ok(GatewayStatus { running: true, pid: Some(pid), owned_by_us: true });

        Ok(GatewayStatus {
            running: false,
            pid: None,
            owned_by_us: false,
        })
    }

    /// Останавливает Gateway **только если он принадлежит нам**.
    pub fn stop(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;

        if !*owned_guard {
            info!("stop() called, but gateway is not owned by us — doing nothing (attach mode)");
            return Ok(GatewayStatus {
                running: self.is_running_internal(&mut child_guard),
                pid: child_guard.as_ref().map(|c| c.id()),
                owned_by_us: false,
            });
        }

        if let Some(mut child) = child_guard.take() {
            info!("Stopping owned gateway (pid={})", child.id());

            // TODO: graceful SIGTERM на Unix
            std::thread::sleep(std::time::Duration::from_millis(300));

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
        })
    }

    pub fn status(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;

        let running = self.is_running_internal(&mut child_guard);
        let pid = if running {
            child_guard.as_ref().map(|c| c.id())
        } else {
            None
        };

        Ok(GatewayStatus {
            running,
            pid,
            owned_by_us: *owned_guard,
        })
    }

    fn is_running_internal(&self, child_guard: &mut Option<Child>) -> bool {
        if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) | Err(_) => {
                    *child_guard = None;
                    false
                }
            }
        } else {
            false
        }
    }
}

impl Drop for GatewayManager {
    fn drop(&mut self) {
        // При уничтождении менеджера гасим процесс только если он наш
        if let Ok(owned) = self.owned_by_us.lock() {
            if *owned {
                info!("GatewayManager dropped — stopping owned gateway");
                let _ = self.stop();
            }
        }
    }
}
