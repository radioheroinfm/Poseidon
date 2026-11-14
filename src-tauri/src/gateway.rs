//! GatewayManager — lifecycle for the Hermes backend (`hermes serve`)
//!
//! Ownership policy (ADR-009):
//! - Kill only if we started the process (`owned_by_us = true`).
//! - If something is already listening — attach, never kill on exit.
//!
//! Upstream readiness (v0.23.0 / 2bd378ed):
//! - Child prints `HERMES_BACKEND_READY port=<N>` (or legacy DASHBOARD) on stdout
//! - Cold start can take 30–60s
//! - Must drain stdout for the whole process lifetime (avoid SIGPIPE)
//! - PYTHONUNBUFFERED=1 so READY is not stuck in a block buffer

use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use log::{info, warn, error, debug};

const DEFAULT_GATEWAY_PORT: u16 = 8642;
const READY_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub owned_by_us: bool,
    pub port_open: bool,
    pub port: Option<u16>,
    pub message: Option<String>,
}

pub struct GatewayManager {
    child: Mutex<Option<Child>>,
    owned_by_us: Mutex<bool>,
    port: Mutex<u16>,
    /// Prevents concurrent start() calls without holding child mutex during wait
    start_guard: Mutex<()>,
}

impl GatewayManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            owned_by_us: Mutex::new(false),
            port: Mutex::new(DEFAULT_GATEWAY_PORT),
            start_guard: Mutex::new(()),
        }
    }

    fn current_port(&self) -> u16 {
        self.port.lock().map(|p| *p).unwrap_or(DEFAULT_GATEWAY_PORT)
    }

    fn set_port(&self, port: u16) {
        if let Ok(mut p) = self.port.lock() {
            *p = port;
        }
    }

    fn is_port_open(port: u16) -> bool {
        TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", port).parse().unwrap(),
            Duration::from_millis(150),
        )
        .is_ok()
    }

    fn parse_ready_line(line: &str) -> Option<u16> {
        let line = line.trim();
        for prefix in ["HERMES_BACKEND_READY", "HERMES_DASHBOARD_READY"] {
            if let Some(rest) = line.strip_prefix(prefix) {
                if let Some(idx) = rest.find("port=") {
                    let num = rest[idx + 5..].split_whitespace().next()?;
                    return num.parse().ok();
                }
            }
        }
        None
    }

    fn find_hermes_binary() -> Option<PathBuf> {
        if which::which("hermes").is_ok() {
            return Some(PathBuf::from("hermes"));
        }
        if let Some(home) = dirs::home_dir() {
            for path in [
                home.join(".hermes/bin/hermes"),
                home.join(".local/bin/hermes"),
                home.join("hermes-agent/.venv/bin/hermes"),
            ] {
                if path.exists() {
                    return Some(path);
                }
            }
        }
        None
    }

    pub fn start(&self) -> Result<GatewayStatus, String> {
        // Serialize concurrent start() without holding child mutex during READY wait
        let _start_lock = self.start_guard.lock().map_err(|e| e.to_string())?;

        // --- Phase A: quick state check under lock ---
        {
            let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
            let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;
            let port_now = self.current_port();

            if let Some(child) = child_guard.as_mut() {
                match child.try_wait() {
                    Ok(None) => {
                        info!("Gateway already owned (pid={})", child.id());
                        return Ok(GatewayStatus {
                            running: true,
                            pid: Some(child.id()),
                            owned_by_us: true,
                            port_open: Self::is_port_open(port_now),
                            port: Some(port_now),
                            message: Some("already running (owned)".into()),
                        });
                    }
                    Ok(Some(status)) => {
                        warn!("Owned gateway exited: {:?}", status);
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

            if Self::is_port_open(port_now) {
                info!("Port {} open — attach mode", port_now);
                *owned_guard = false;
                return Ok(GatewayStatus {
                    running: true,
                    pid: None,
                    owned_by_us: false,
                    port_open: true,
                    port: Some(port_now),
                    message: Some("attached to existing gateway".into()),
                });
            }
        } // locks released before spawn/wait

        let hermes = match Self::find_hermes_binary() {
            Some(p) => p,
            None => {
                let msg = "hermes binary not found in PATH or common locations";
                warn!("{}", msg);
                return Ok(GatewayStatus {
                    running: false,
                    pid: None,
                    owned_by_us: false,
                    port_open: false,
                    port: None,
                    message: Some(msg.into()),
                });
            }
        };

        info!("Starting gateway via {:?}", hermes);

        let mut cmd = Command::new(&hermes);
        cmd.arg("serve")
            .env("PYTHONUNBUFFERED", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("Failed to spawn hermes: {}", e);
                error!("{}", msg);
                return Ok(GatewayStatus {
                    running: false,
                    pid: None,
                    owned_by_us: false,
                    port_open: false,
                    port: None,
                    message: Some(msg),
                });
            }
        };

        let pid = child.id();
        info!(
            "Gateway spawned (pid={}), ownership recorded immediately; waiting for READY (up to {}s)",
            pid,
            READY_TIMEOUT.as_secs()
        );

        // --- Phase B: take stdout, THEN record ownership BEFORE any wait (R1) ---
        let (tx, rx) = mpsc::channel::<u16>();
        if let Some(stdout) = child.stdout.take() {
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                let mut sent = false;
                for line in reader.lines() {
                    match line {
                        Ok(line) => {
                            if !sent {
                                if let Some(port) = GatewayManager::parse_ready_line(&line) {
                                    let _ = tx.send(port);
                                    sent = true;
                                }
                            }
                            debug!("[hermes serve] {}", line);
                        }
                        Err(e) => {
                            debug!("gateway stdout closed: {}", e);
                            break;
                        }
                    }
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    match line {
                        Ok(line) => warn!("[hermes serve:stderr] {}", line),
                        Err(e) => {
                            debug!("gateway stderr closed: {}", e);
                            break;
                        }
                    }
                }
            });
        }

        // Record ownership IMMEDIATELY so Exit/stop during cold start can kill us (R1)
        {
            let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
            let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;
            *child_guard = Some(child);
            *owned_guard = true;
        }

        // Wait for READY without holding child/owned mutexes
        let announced_port = match rx.recv_timeout(READY_TIMEOUT) {
            Ok(port) => {
                info!("Got READY on port {}", port);
                Some(port)
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                warn!("Timeout waiting for HERMES_*_READY");
                None
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                warn!("stdout closed before READY");
                None
            }
        };

        if let Some(port) = announced_port {
            self.set_port(port);
        }

        // If process died before READY — clear ownership and report honestly
        let alive = {
            let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
            match child_guard.as_mut().map(|c| c.try_wait()) {
                Some(Ok(None)) => true,
                Some(Ok(Some(status))) => {
                    warn!("Gateway exited before READY: {:?}", status);
                    *child_guard = None;
                    if let Ok(mut o) = self.owned_by_us.lock() {
                        *o = false;
                    }
                    false
                }
                Some(Err(e)) => {
                    error!("Error probing gateway after READY wait: {}", e);
                    *child_guard = None;
                    if let Ok(mut o) = self.owned_by_us.lock() {
                        *o = false;
                    }
                    false
                }
                None => false,
            }
        };

        if !alive {
            return Ok(GatewayStatus {
                running: false,
                pid: None,
                owned_by_us: false,
                port_open: false,
                port: None,
                message: Some("hermes exited before READY".into()),
            });
        }

        let port = announced_port.unwrap_or_else(|| self.current_port());
        let port_open = Self::is_port_open(port);

        let message = match (announced_port, port_open) {
            (Some(p), true) => format!("started by Poseidon (READY port={})", p),
            (Some(p), false) => format!("started by Poseidon (READY port={} but not open yet)", p),
            (None, true) => "started by Poseidon (no READY line, port open)".into(),
            (None, false) => "started by Poseidon (no READY line yet — still starting?)".into(),
        };

        Ok(GatewayStatus {
            running: true,
            pid: Some(pid),
            owned_by_us: true,
            port_open,
            port: if port_open || announced_port.is_some() {
                Some(port)
            } else {
                None
            },
            message: Some(message),
        })
    }

    pub fn stop(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;
        let port_now = self.current_port();

        if !*owned_guard {
            info!("stop() — not owned, leaving untouched");
            let port_open = Self::is_port_open(port_now);
            return Ok(GatewayStatus {
                running: port_open,
                pid: None,
                owned_by_us: false,
                port_open,
                port: if port_open { Some(port_now) } else { None },
                message: Some("not owned — left untouched".into()),
            });
        }

        if let Some(mut child) = child_guard.take() {
            let pid = child.id();
            info!("Stopping owned gateway (pid={})", pid);

            #[cfg(unix)]
            {
                unsafe {
                    libc::kill(-(pid as i32), libc::SIGTERM);
                }
                std::thread::sleep(Duration::from_millis(450));
            }

            match child.try_wait() {
                Ok(Some(_)) => info!("Gateway exited"),
                _ => {
                    warn!("Gateway still alive, SIGKILL process group");
                    #[cfg(unix)]
                    {
                        unsafe {
                            libc::kill(-(pid as i32), libc::SIGKILL);
                        }
                    }
                    #[cfg(not(unix))]
                    {
                        let _ = child.kill();
                    }
                    let _ = child.wait();
                }
            }
        }

        *owned_guard = false;

        let port_open = Self::is_port_open(port_now);
        Ok(GatewayStatus {
            running: false,
            pid: None,
            owned_by_us: false,
            port_open,
            port: if port_open { Some(port_now) } else { None },
            message: Some("stopped".into()),
        })
    }

    pub fn status(&self) -> Result<GatewayStatus, String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        let mut owned_guard = self.owned_by_us.lock().map_err(|e| e.to_string())?;
        let port_now = self.current_port();
        let port_open = Self::is_port_open(port_now);

        let (running, pid) = if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(None) => (true, Some(child.id())),
                _ => {
                    // Child died — clear ownership (critical fix from Zhenya audit)
                    *child_guard = None;
                    *owned_guard = false;
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
            port: if port_open || running { Some(port_now) } else { None },
            message: None,
        })
    }
}

impl Drop for GatewayManager {
    fn drop(&mut self) {
        let should_stop = self.owned_by_us.lock().map(|g| *g).unwrap_or(false);
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
    fn parse_ready_backend() {
        assert_eq!(
            GatewayManager::parse_ready_line("HERMES_BACKEND_READY port=8642"),
            Some(8642)
        );
    }

    #[test]
    fn parse_ready_dashboard_legacy() {
        assert_eq!(
            GatewayManager::parse_ready_line("HERMES_DASHBOARD_READY port=9001"),
            Some(9001)
        );
    }

    #[test]
    fn parse_ready_ignores_noise() {
        assert_eq!(GatewayManager::parse_ready_line("listening on 1234"), None);
        assert_eq!(GatewayManager::parse_ready_line(""), None);
    }

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
    }
}
