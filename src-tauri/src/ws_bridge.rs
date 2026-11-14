//! ADR-015: Gateway WebSocket owned by Rust (no browser Origin).
//! Spike 1 transport foundation.

use log::{info, warn, debug};
use serde::Serialize;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[cfg(unix)]
use crate::local_gateway;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WsStatus {
    pub connected: bool,
    pub message: Option<String>,
}

struct SessionInner {
    tx: Option<std::sync::mpsc::Sender<Outbound>>,
}

enum Outbound {
    Text(String),
    Close,
}

pub struct WsBridge {
    inner: Mutex<SessionInner>,
}

impl WsBridge {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(SessionInner { tx: None }),
        }
    }

    pub fn is_connected(&self) -> bool {
        self.inner
            .lock()
            .map(|g| g.tx.is_some())
            .unwrap_or(false)
    }

    /// Mint ticket + dial; spawn reader thread; emit gateway-ws-frame / gateway-ws-status.
    pub fn connect(&self, app: AppHandle) -> Result<WsStatus, String> {
        #[cfg(not(unix))]
        {
            let _ = app;
            return Err("ws_bridge connect is unix-only for now".into());
        }
        #[cfg(unix)]
        {
            // Close previous session if any
            let _ = self.close();

            let full = local_gateway::mint_local_ws_url()?;
            let (dial_url, ticket) = parse_ticket_url(&full)?;

            use std::net::TcpStream;
            use tungstenite::client::IntoClientRequest;
            use tungstenite::http::header::{HeaderValue, SEC_WEBSOCKET_PROTOCOL};
            use tungstenite::Message;

            let mut req = dial_url
                .as_str()
                .into_client_request()
                .map_err(|e| format!("ws request: {}", e))?;
            let proto = format!("hermes-gateway-v1, hermes-gateway-ticket.{}", ticket);
            req.headers_mut().insert(
                SEC_WEBSOCKET_PROTOCOL,
                HeaderValue::from_str(&proto).map_err(|e| format!("protocol header: {}", e))?,
            );

            let host_port = dial_url
                .trim_start_matches("ws://")
                .trim_start_matches("wss://")
                .split('/')
                .next()
                .ok_or_else(|| "bad dial url host".to_string())?;
            let stream = TcpStream::connect(host_port)
                .map_err(|e| format!("tcp connect {}: {}", host_port, e))?;
            stream
                .set_read_timeout(Some(Duration::from_secs(1)))
                .ok();
            stream
                .set_write_timeout(Some(Duration::from_secs(10)))
                .ok();

            let (mut socket, response) = tungstenite::client::client(req, stream)
                .map_err(|e| format!("ws handshake: {}", e))?;
            let accepted = response
                .headers()
                .get(SEC_WEBSOCKET_PROTOCOL)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();
            info!("ws_bridge connected protocol={}", accepted);
            let accepted_for_status = accepted.clone();

            let (tx, rx) = std::sync::mpsc::channel::<Outbound>();
            {
                let mut g = self.inner.lock().map_err(|e| e.to_string())?;
                g.tx = Some(tx);
            }

            let app_reader = app.clone();
            thread::spawn(move || {
                let _ = app_reader.emit(
                    "gateway-ws-status",
                    WsStatus {
                        connected: true,
                        message: Some(format!("connected {}", accepted_for_status)),
                    },
                );
                loop {
                    // Handle outbound
                    while let Ok(msg) = rx.try_recv() {
                        match msg {
                            Outbound::Text(t) => {
                                if let Err(e) = socket.send(Message::Text(t.into())) {
                                    warn!("ws send: {}", e);
                                    let _ = app_reader.emit(
                                        "gateway-ws-status",
                                        WsStatus {
                                            connected: false,
                                            message: Some(format!("send error: {}", e)),
                                        },
                                    );
                                    return;
                                }
                            }
                            Outbound::Close => {
                                let _ = socket.close(None);
                                let _ = app_reader.emit(
                                    "gateway-ws-status",
                                    WsStatus {
                                        connected: false,
                                        message: Some("closed by client".into()),
                                    },
                                );
                                return;
                            }
                        }
                    }

                    match socket.read() {
                        Ok(Message::Text(txt)) => {
                            debug!("ws frame {} bytes", txt.len());
                            let _ = app_reader.emit("gateway-ws-frame", txt.to_string());
                        }
                        Ok(Message::Ping(p)) => {
                            let _ = socket.send(Message::Pong(p));
                        }
                        Ok(Message::Close(_)) => {
                            let _ = app_reader.emit(
                                "gateway-ws-status",
                                WsStatus {
                                    connected: false,
                                    message: Some("server close".into()),
                                },
                            );
                            return;
                        }
                        Ok(_) => {}
                        Err(tungstenite::Error::Io(ref e))
                            if e.kind() == std::io::ErrorKind::WouldBlock
                                || e.kind() == std::io::ErrorKind::TimedOut =>
                        {
                            // read timeout — loop to check outbound
                            continue;
                        }
                        Err(e) => {
                            warn!("ws read: {}", e);
                            let _ = app_reader.emit(
                                "gateway-ws-status",
                                WsStatus {
                                    connected: false,
                                    message: Some(format!("read error: {}", e)),
                                },
                            );
                            return;
                        }
                    }
                }
            });

            Ok(WsStatus {
                connected: true,
                message: Some(format!("connected protocol={}", accepted)),
            })
        }
    }

    pub fn send_text(&self, text: String) -> Result<(), String> {
        let g = self.inner.lock().map_err(|e| e.to_string())?;
        let tx = g.tx.as_ref().ok_or_else(|| "ws not connected".to_string())?;
        tx.send(Outbound::Text(text))
            .map_err(|e| format!("ws send channel: {}", e))
    }

    pub fn close(&self) -> Result<WsStatus, String> {
        let mut g = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(tx) = g.tx.take() {
            let _ = tx.send(Outbound::Close);
        }
        Ok(WsStatus {
            connected: false,
            message: Some("disconnect requested".into()),
        })
    }
}

fn parse_ticket_url(full: &str) -> Result<(String, String), String> {
    let ticket_key = "ticket=";
    let idx = full
        .find(ticket_key)
        .ok_or_else(|| "minted url missing ticket=".to_string())?;
    let rest = &full[idx + ticket_key.len()..];
    let ticket = rest.split('&').next().unwrap_or("").to_string();
    if ticket.is_empty() {
        return Err("empty ticket".into());
    }
    let without = if full.contains(&format!("&ticket={}", ticket)) {
        full.replace(&format!("&ticket={}", ticket), "")
    } else {
        full.replace(&format!("ticket={}", ticket), "")
    };
    let without = without.replace("?&", "?").trim_end_matches('?').to_string();
    Ok((without, ticket))
}
