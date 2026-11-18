//! ADR-015 / Kolyan D: multi-session gateway WebSocket owned by Rust.

use log::{info, warn, debug};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsOpenArgs {
    pub id: String,
    pub url: String,
    pub protocols: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WsStatusEvent {
    pub id: String,
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub was_clean: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WsFrameEvent {
    pub id: String,
    pub data: String,
}

enum Outbound {
    Text(String),
    Close,
}

struct Session {
    tx: std::sync::mpsc::Sender<Outbound>,
}

pub struct WsBridge {
    sessions: Mutex<HashMap<String, Session>>,
}

impl WsBridge {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Open session using URL+protocols from renderer (validated).
    pub fn open(&self, app: AppHandle, args: WsOpenArgs) -> Result<(), String> {
        let id = args.id.clone();
        validate_gateway_url(&args.url)?;
        let protocols = args.protocols.clone().unwrap_or_default();
        validate_protocols(&protocols)?;

        // Close existing same id
        let _ = self.close_id(&id);

        let url = args.url.clone();
        let (tx, rx) = std::sync::mpsc::channel::<Outbound>();
        {
            let mut g = self.sessions.lock().map_err(|e| e.to_string())?;
            g.insert(id.clone(), Session { tx });
        }

        let app_reader = app.clone();
        let sid = id.clone();
        thread::spawn(move || {
            if let Err(e) = run_session(app_reader.clone(), sid.clone(), url, protocols, rx) {
                warn!("session {}: {}", sid, e);
                let _ = app_reader.emit(
                    "gateway-ws-status",
                    WsStatusEvent {
                        id: sid,
                        connected: false,
                        message: Some(e),
                        protocol: None,
                        code: Some(1006),
                        was_clean: Some(false),
                    },
                );
            }
        });

        Ok(())
    }

    pub fn send(&self, id: &str, text: String) -> Result<(), String> {
        let g = self.sessions.lock().map_err(|e| e.to_string())?;
        let s = g.get(id).ok_or_else(|| format!("no session {}", id))?;
        s.tx
            .send(Outbound::Text(text))
            .map_err(|e| format!("send channel: {}", e))
    }

    pub fn close_id(&self, id: &str) -> Result<(), String> {
        let mut g = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(s) = g.remove(id) {
            let _ = s.tx.send(Outbound::Close);
        }
        Ok(())
    }

    pub fn close_all(&self) {
        if let Ok(mut g) = self.sessions.lock() {
            for (_, s) in g.drain() {
                let _ = s.tx.send(Outbound::Close);
            }
        }
    }
}

fn validate_gateway_url(url: &str) -> Result<(), String> {
    // Manual parse to avoid url crate dep
    let u = url.trim();
    let rest = if let Some(r) = u.strip_prefix("ws://") {
        r
    } else if let Some(r) = u.strip_prefix("wss://") {
        r
    } else {
        return Err(format!("only ws/wss allowed: {}", url));
    };
    let (hostport, pathq) = rest
        .split_once('/')
        .map(|(h, p)| (h, format!("/{}", p)))
        .unwrap_or((rest, "/".into()));
    let host = hostport.split(':').next().unwrap_or(hostport);
    if host != "127.0.0.1" && host != "localhost" && host != "[::1]" && host != "::1" {
        return Err(format!("host not loopback: {}", host));
    }
    let path = pathq.split('?').next().unwrap_or(&pathq);
    if path != "/api/ws" {
        return Err(format!("path must be /api/ws, got {}", path));
    }
    Ok(())
}

fn validate_protocols(protocols: &[String]) -> Result<(), String> {
    let mut has_v1 = false;
    let mut ticket_count = 0;
    for p in protocols {
        if p == "hermes-gateway-v1" {
            has_v1 = true;
        } else if p.starts_with("hermes-gateway-ticket.") {
            ticket_count += 1;
        } else {
            return Err(format!("protocol not allowed: {}", p));
        }
    }
    if !has_v1 {
        return Err("missing hermes-gateway-v1".into());
    }
    if ticket_count != 1 {
        return Err(format!("need exactly one ticket protocol, got {}", ticket_count));
    }
    Ok(())
}

fn run_session(
    app: AppHandle,
    id: String,
    full_url: String,
    protocols: Vec<String>,
    rx: std::sync::mpsc::Receiver<Outbound>,
) -> Result<(), String> {
    use std::net::TcpStream;
    use tungstenite::client::IntoClientRequest;
    use tungstenite::http::header::{HeaderValue, SEC_WEBSOCKET_PROTOCOL};
    use tungstenite::Message;

    // Strip ticket from query if present (canonical wire puts it in subprotocol)
    let dial_url = strip_ticket_query(&full_url);

    let mut req = dial_url
        .as_str()
        .into_client_request()
        .map_err(|e| format!("ws request: {}", e))?;
    let proto_header = protocols.join(", ");
    req.headers_mut().insert(
        SEC_WEBSOCKET_PROTOCOL,
        HeaderValue::from_str(&proto_header).map_err(|e| format!("protocol header: {}", e))?,
    );

    let host_port = dial_url
        .trim_start_matches("ws://")
        .trim_start_matches("wss://")
        .split('/')
        .next()
        .ok_or_else(|| "bad host".to_string())?;
    let stream =
        TcpStream::connect(host_port).map_err(|e| format!("tcp {}: {}", host_port, e))?;
    // Kolyan N1: 50ms so outbound is not delayed up to 1s
    stream
        .set_read_timeout(Some(Duration::from_millis(50)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_secs(10)))
        .ok();

    let (mut socket, response) =
        tungstenite::client::client(req, stream).map_err(|e| format!("handshake: {}", e))?;
    let accepted = response
        .headers()
        .get(SEC_WEBSOCKET_PROTOCOL)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    info!("session {} connected protocol={}", id, accepted);

    let _ = app.emit(
        "gateway-ws-status",
        WsStatusEvent {
            id: id.clone(),
            connected: true,
            message: Some("connected".into()),
            protocol: Some(accepted.clone()),
            code: None,
            was_clean: None,
        },
    );

    loop {
        while let Ok(msg) = rx.try_recv() {
            match msg {
                Outbound::Text(t) => {
                    if let Err(e) = socket.send(Message::Text(t.into())) {
                        let _ = app.emit(
                            "gateway-ws-status",
                            WsStatusEvent {
                                id: id.clone(),
                                connected: false,
                                message: Some(format!("send: {}", e)),
                                protocol: None,
                                code: Some(1006),
                                was_clean: Some(false),
                            },
                        );
                        return Err(format!("send: {}", e));
                    }
                }
                Outbound::Close => {
                    let _ = socket.close(None);
                    let _ = app.emit(
                        "gateway-ws-status",
                        WsStatusEvent {
                            id: id.clone(),
                            connected: false,
                            message: Some("closed by client".into()),
                            protocol: None,
                            code: Some(1000),
                            was_clean: Some(true),
                        },
                    );
                    return Ok(());
                }
            }
        }

        match socket.read() {
            Ok(Message::Text(txt)) => {
                debug!("session {} frame {} bytes", id, txt.len());
                let _ = app.emit(
                    "gateway-ws-frame",
                    WsFrameEvent {
                        id: id.clone(),
                        data: txt.to_string(),
                    },
                );
            }
            Ok(Message::Ping(p)) => {
                let _ = socket.send(Message::Pong(p));
            }
            Ok(Message::Close(_)) => {
                let _ = app.emit(
                    "gateway-ws-status",
                    WsStatusEvent {
                        id: id.clone(),
                        connected: false,
                        message: Some("server close".into()),
                        protocol: None,
                        code: Some(1000),
                        was_clean: Some(true),
                    },
                );
                return Ok(());
            }
            Ok(_) => {}
            Err(tungstenite::Error::Io(ref e))
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                continue;
            }
            Err(e) => {
                let _ = app.emit(
                    "gateway-ws-status",
                    WsStatusEvent {
                        id: id.clone(),
                        connected: false,
                        message: Some(format!("read: {}", e)),
                        protocol: None,
                        code: Some(1006),
                        was_clean: Some(false),
                    },
                );
                return Err(format!("read: {}", e));
            }
        }
    }
}

fn strip_ticket_query(url: &str) -> String {
    if !url.contains("ticket=") {
        return url.to_string();
    }
    // Remove ticket=...& or &ticket=... or ?ticket=...
    let mut out = url.to_string();
    if let Some(idx) = out.find("ticket=") {
        let start = if idx > 0 && (out.as_bytes()[idx - 1] == b'&' || out.as_bytes()[idx - 1] == b'?')
        {
            idx - 1
        } else {
            idx
        };
        let rest = &out[idx + "ticket=".len()..];
        let end_rel = rest.find('&').unwrap_or(rest.len());
        let end = idx + "ticket=".len() + end_rel;
        out = format!("{}{}", &out[..start], &out[end..]);
        out = out.replace("?&", "?").trim_end_matches('?').to_string();
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_loopback_api_ws() {
        assert!(validate_gateway_url("ws://127.0.0.1:55057/api/ws?native_dial=x").is_ok());
    }

    #[test]
    fn rejects_remote() {
        assert!(validate_gateway_url("ws://evil.com/api/ws").is_err());
    }

    #[test]
    fn protocols_ok() {
        assert!(validate_protocols(&[
            "hermes-gateway-v1".into(),
            "hermes-gateway-ticket.abc".into()
        ])
        .is_ok());
    }
}
