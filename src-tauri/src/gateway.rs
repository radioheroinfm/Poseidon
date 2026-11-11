//! GatewayManager — управление жизненным циклом Python-процесса `hermes serve`
//!
//! Главные требования (из аудита Жени + здравого смысла):
//! 1. Никаких зомби-процессов
//! 2. Никаких блокировок SQLite после крэша/закрытия
//! 3. Корректный graceful shutdown + fallback на kill
//! 4. RAII: когда GatewayManager умирает — процесс тоже должен умереть

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use log::{info, warn, error};

pub struct GatewayManager {
    child: Mutex<Option<Child>>,
}

impl GatewayManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }

    /// Запускает `hermes serve`, если ещё не запущен
    pub fn start(&self) -> Result<(), String> {
        let mut guard = self.child.lock().map_err(|e| e.to_string())?;

        if let Some(child) = guard.as_mut() {
            // Уже запущен? Проверяем, жив ли
            match child.try_wait() {
                Ok(Some(status)) => {
                    warn!("Previous gateway process exited with {:?}", status);
                    *guard = None;
                }
                Ok(None) => {
                    info!("Gateway already running (pid={})", child.id());
                    return Ok(());
                }
                Err(e) => {
                    error!("Error checking gateway process: {}", e);
                    *guard = None;
                }
            }
        }

        // TODO: искать hermes в PATH / в ~/.hermes / рядом с бинарником
        // Пока просто честная заглушка
        info!("Gateway start requested (real spawn not yet implemented)");

        // Пример будущего кода:
        // let child = Command::new("hermes")
        //     .arg("serve")
        //     .stdout(Stdio::null())
        //     .stderr(Stdio::null())
        //     .spawn()
        //     .map_err(|e| format!("Failed to start hermes serve: {}", e))?;
        //
        // *guard = Some(child);

        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut guard = self.child.lock().map_err(|e| e.to_string())?;

        if let Some(mut child) = guard.take() {
            info!("Stopping gateway (pid={})", child.id());

            // Сначала пробуем gracefully
            #[cfg(unix)]
            {
                // TODO: nix::sys::signal::kill(pid, SIGTERM)
            }

            // Даем немного времени и убиваем
            std::thread::sleep(std::time::Duration::from_millis(400));

            match child.try_wait() {
                Ok(Some(_)) => {
                    info!("Gateway exited gracefully");
                }
                _ => {
                    warn!("Gateway did not exit in time, killing");
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        let mut guard = match self.child.lock() {
            Ok(g) => g,
            Err(_) => return false,
        };

        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) => {
                    *guard = None;
                    false
                }
                Err(_) => {
                    *guard = None;
                    false
                }
            }
        } else {
            false
        }
    }

    pub fn pid(&self) -> Option<u32> {
        let guard = self.child.lock().ok()?;
        guard.as_ref().map(|c| c.id())
    }
}

impl Drop for GatewayManager {
    fn drop(&mut self) {
        // RAII: при уничтожении менеджера обязательно гасим процесс
        if let Err(e) = self.stop() {
            error!("Error while stopping gateway in Drop: {}", e);
        }
    }
}
