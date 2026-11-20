//! ADR-015 (rev. Kolyan patch 01): gateway WebSocket sessions owned by Rust.
//!
//! The WebView cannot dial the Hermes gateway itself (browser `Origin` is
//! rejected with 1006), so the renderer asks Rust to dial on its behalf.
//!
//! What changed vs. the Spike 1 skeleton:
//! - many sessions, addressed by an id chosen by the renderer (N2);
//! - Rust dials the URL the renderer received from `getGatewayWsUrl`
//!   (after strict validation) instead of re-minting a ticket (N3);
//! - the poll interval is 25 ms, so outbound frames no longer wait up to 1 s (N1);
//! - events go through an `Emit` callback, so the bridge is testable
//!   without a Tauri `AppHandle`.
//!
//! Session ids MUST be unique per socket (the JS shim guarantees this).
//! The only reused id is `LEGACY_ID`, kept for the placeholder smoke buttons.

use log::{debug, info, warn};
use serde::Serialize;
use std::collections::HashMap;
use std::io::ErrorKind;
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tungstenite::client::IntoClientRequest;
use tungstenite::http::header::{HeaderValue, SEC_WEBSOCKET_PROTOCOL};
use tungstenite::{Message, WebSocket};

pub const LEGACY_ID: &str = "legacy";

const POLL: Duration = Duration::from_millis(25);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(5);
const WRITE_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_URL_LEN: usize = 2048;
const MAX_PROTOCOL_LEN: usize = 512;
const SUBPROTOCOL_V1: &str = "hermes-gateway-v1";
const SUBPROTOCOL_TICKET_PREFIX: &str = "hermes-gateway-ticket.";
const GATEWAY_PATH: &str = "/api/ws";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WsStatus {
    pub connected: bool,
    pub message: Option<String>,
}

/// Event produced by a session thread.
#[derive(Debug, Clone)]
pub enum WsEvent {
    Frame {
        id: String,
        data: String,
    },
    Status {
        id: String,
        connected: bool,
        message: Option<String>,
        /// WebSocket close code (1000 client close, 1006 abnormal, or the server's code).
        code: Option<u16>,
    },
}

pub type Emit = Arc<dyn Fn(WsEvent) + Send + Sync + 'static>;

enum Outbound {
    Text(String),
    Close,
}

struct Session {
    generation: u64,
    tx: Sender<Outbound>,
}

#[derive(Default)]
struct Inner {
    sessions: HashMap<String, Session>,
    next_gen: u64,
    /// Port announced by the last successful ticket mint (`getGatewayWsUrl`).
    allowed_port: Option<u16>,
}

pub struct WsBridge {
    inner: Arc<Mutex<Inner>>,
}

// ---------------------------------------------------------------------------
// Validation (pure functions, unit-tested)
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq, Eq)]
pub struct ValidatedDial {
    pub url: String,
    pub host: String,
    pub port: u16,
    pub protocols: Vec<String>,
}

fn split_host_port(authority: &str) -> Result<(String, u16), String> {
    if authority.contains('@') {
        return Err("userinfo in ws url is not allowed".into());
    }
    let (host, port_str) = if let Some(rest) = authority.strip_prefix('[') {
        let end = rest.find(']').ok_or("bad ipv6 authority")?;
        let host = format!("[{}]", &rest[..end]);
        let after = &rest[end + 1..];
        let p = after.strip_prefix(':').ok_or("port required")?;
        (host, p)
    } else {
        let i = authority.rfind(':').ok_or("port required")?;
        (authority[..i].to_string(), &authority[i + 1..])
    };
    let port: u16 = port_str.parse().map_err(|_| "bad port".to_string())?;
    if port == 0 {
        return Err("bad port".into());
    }
    Ok((host, port))
}

/// Port of a `ws://host:port/...` URL, if it parses.
pub fn ws_url_port(url: &str) -> Option<u16> {
    let rest = url.strip_prefix("ws://")?;
    let authority = rest.split(|c: char| c == '/' || c == '?').next()?;
    split_host_port(authority).ok().map(|(_, p)| p)
}

fn protocol_ok(p: &str) -> bool {
    if p.is_empty() || p.len() > MAX_PROTOCOL_LEN {
        return false;
    }
    if !p.chars().all(|c| c.is_ascii_graphic() && c != ',') {
        return false;
    }
    p == SUBPROTOCOL_V1
        || (p.starts_with(SUBPROTOCOL_TICKET_PREFIX) && p.len() > SUBPROTOCOL_TICKET_PREFIX.len())
}

/// Only loopback `ws://host:port/api/ws[?query]` on the port announced by the
/// last ticket mint, with the two known subprotocol shapes, may be dialed.
pub fn validate_dial(
    url: &str,
    protocols: &[String],
    allowed_port: Option<u16>,
) -> Result<ValidatedDial, String> {
    if url.len() > MAX_URL_LEN {
        return Err("ws url too long".into());
    }
    let rest = url
        .strip_prefix("ws://")
        .ok_or("only ws:// loopback dials are allowed")?;
    let end = rest.find(|c: char| c == '/' || c == '?').unwrap_or(rest.len());
    let authority = &rest[..end];
    let path_query = &rest[end..];
    let (host, port) = split_host_port(authority)?;
    if !(host == "127.0.0.1" || host == "localhost" || host == "[::1]") {
        return Err(format!("host '{}' is not loopback", host));
    }
    match allowed_port {
        None => {
            return Err("no gateway endpoint announced yet (call getGatewayWsUrl first)".into())
        }
        Some(p) if p != port => {
            return Err(format!("port {} is not the announced gateway port", port))
        }
        Some(_) => {}
    }
    let path = path_query.split('?').next().unwrap_or("");
    if path != GATEWAY_PATH {
        return Err(format!("path '{}' is not {}", path, GATEWAY_PATH));
    }
    if protocols.is_empty() || protocols.len() > 2 {
        return Err("expected 1..2 subprotocols".into());
    }
    if !protocols.iter().all(|p| protocol_ok(p)) {
        return Err("subprotocol not allowed".into());
    }
    Ok(ValidatedDial {
        url: url.to_string(),
        host,
        port,
        protocols: protocols.to_vec(),
    })
}

/// Split a minted URL into (dial url without ticket, ticket).
pub fn parse_ticket_url(full: &str) -> Result<(String, String), String> {
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

fn connect_tcp(host: &str, port: u16) -> Result<TcpStream, String> {
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    let addrs = (bare, port)
        .to_socket_addrs()
        .map_err(|e| format!("resolve {}:{}: {}", host, port, e))?;
    let mut last = format!("no addresses for {}:{}", host, port);
    for addr in addrs {
        match TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT) {
            Ok(s) => return Ok(s),
            Err(e) => last = format!("tcp connect {}: {}", addr, e),
        }
    }
    Err(last)
}

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

impl WsBridge {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner::default())),
        }
    }

    /// Record the gateway port announced by a ticket mint. Dials to any other
    /// port are refused.
    pub fn allow_port(&self, port: u16) {
        if let Ok(mut g) = self.inner.lock() {
            g.allowed_port = Some(port);
        }
    }

    pub fn is_session_open(&self, id: &str) -> bool {
        self.inner
            .lock()
            .map(|g| g.sessions.contains_key(id))
            .unwrap_or(false)
    }

    /// Legacy single-session view (placeholder smoke buttons).
    pub fn is_connected(&self) -> bool {
        self.is_session_open(LEGACY_ID)
    }

    /// Dial `url` (validated) and spawn the session thread.
    pub fn open(
        &self,
        emit: Emit,
        id: &str,
        url: &str,
        protocols: &[String],
    ) -> Result<WsStatus, String> {
        let allowed = self.inner.lock().map_err(|e| e.to_string())?.allowed_port;
        let v = validate_dial(url, protocols, allowed)?;

        // Same id again: replace the old session.
        let _ = self.close_id(id);

        let mut req = v
            .url
            .as_str()
            .into_client_request()
            .map_err(|e| format!("ws request: {}", e))?;
        req.headers_mut().insert(
            SEC_WEBSOCKET_PROTOCOL,
            HeaderValue::from_str(&v.protocols.join(", "))
                .map_err(|e| format!("protocol header: {}", e))?,
        );

        let stream = connect_tcp(&v.host, v.port)?;
        stream.set_nodelay(true).ok();
        stream.set_read_timeout(Some(HANDSHAKE_TIMEOUT)).ok();
        stream.set_write_timeout(Some(WRITE_TIMEOUT)).ok();

        let (socket, response) = tungstenite::client::client(req, stream)
            .map_err(|e| format!("ws handshake: {}", e))?;
        let accepted = response
            .headers()
            .get(SEC_WEBSOCKET_PROTOCOL)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        info!("ws_bridge[{}] connected protocol={}", id, accepted);

        // After the handshake switch to the short poll interval (N1).
        socket.get_ref().set_read_timeout(Some(POLL)).ok();

        let (tx, rx) = mpsc::channel::<Outbound>();
        let generation = {
            let mut g = self.inner.lock().map_err(|e| e.to_string())?;
            g.next_gen += 1;
            let generation = g.next_gen;
            g.sessions.insert(id.to_string(), Session { generation, tx });
            generation
        };

        let inner = Arc::clone(&self.inner);
        let id_owned = id.to_string();
        let accepted_msg = format!("connected {}", accepted);
        thread::spawn(move || run_session(id_owned, socket, rx, emit, inner, generation, accepted_msg));

        Ok(WsStatus {
            connected: true,
            message: Some(format!("connected protocol={}", accepted)),
        })
    }

    pub fn send_to(&self, id: &str, text: String) -> Result<(), String> {
        let g = self.inner.lock().map_err(|e| e.to_string())?;
        let s = g
            .sessions
            .get(id)
            .ok_or_else(|| format!("ws session '{}' is not connected", id))?;
        s.tx.send(Outbound::Text(text))
            .map_err(|e| format!("ws send channel: {}", e))
    }

    pub fn close_id(&self, id: &str) -> Result<WsStatus, String> {
        let removed = {
            let mut g = self.inner.lock().map_err(|e| e.to_string())?;
            g.sessions.remove(id)
        };
        if let Some(s) = removed {
            let _ = s.tx.send(Outbound::Close);
        }
        Ok(WsStatus {
            connected: false,
            message: Some("disconnect requested".into()),
        })
    }

    pub fn close_all(&self) {
        let drained: Vec<Session> = match self.inner.lock() {
            Ok(mut g) => g.sessions.drain().map(|(_, s)| s).collect(),
            Err(_) => return,
        };
        for s in drained {
            let _ = s.tx.send(Outbound::Close);
        }
    }

    // Legacy single-session helpers used by the placeholder smoke buttons.
    pub fn send_text(&self, text: String) -> Result<(), String> {
        self.send_to(LEGACY_ID, text)
    }

    pub fn close(&self) -> Result<WsStatus, String> {
        self.close_id(LEGACY_ID)
    }
}

fn finish(inner: &Arc<Mutex<Inner>>, id: &str, generation: u64) {
    if let Ok(mut g) = inner.lock() {
        if g.sessions.get(id).map(|s| s.generation) == Some(generation) {
            g.sessions.remove(id);
        }
    }
}

fn run_session(
    id: String,
    mut socket: WebSocket<TcpStream>,
    rx: Receiver<Outbound>,
    emit: Emit,
    inner: Arc<Mutex<Inner>>,
    generation: u64,
    connected_msg: String,
) {
    emit(WsEvent::Status {
        id: id.clone(),
        connected: true,
        message: Some(connected_msg),
        code: None,
    });

    let (message, code): (String, Option<u16>) = 'outer: loop {
        // 1) drain outbound
        loop {
            match rx.try_recv() {
                Ok(Outbound::Text(t)) => {
                    if let Err(e) = socket.send(Message::Text(t.into())) {
                        warn!("ws_bridge[{}] send: {}", id, e);
                        break 'outer (format!("send error: {}", e), Some(1006));
                    }
                }
                Ok(Outbound::Close) => {
                    let _ = socket.close(None);
                    let _ = socket.flush();
                    break 'outer ("closed by client".to_string(), Some(1000));
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    let _ = socket.close(None);
                    let _ = socket.flush();
                    break 'outer ("bridge dropped".to_string(), Some(1000));
                }
            }
        }

        // 2) read (blocks at most POLL)
        match socket.read() {
            Ok(Message::Text(txt)) => {
                debug!("ws_bridge[{}] frame {} bytes", id, txt.len());
                emit(WsEvent::Frame {
                    id: id.clone(),
                    data: txt.to_string(),
                });
            }
            Ok(Message::Ping(p)) => {
                let _ = socket.send(Message::Pong(p));
            }
            Ok(Message::Close(frame)) => {
                let c = frame.map(|f| u16::from(f.code)).unwrap_or(1005);
                break 'outer ("server close".to_string(), Some(c));
            }
            Ok(_) => {}
            Err(tungstenite::Error::Io(ref e))
                if e.kind() == ErrorKind::WouldBlock || e.kind() == ErrorKind::TimedOut =>
            {
                continue;
            }
            Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) => {
                break 'outer ("connection closed".to_string(), Some(1006));
            }
            Err(e) => {
                warn!("ws_bridge[{}] read: {}", id, e);
                break 'outer (format!("read error: {}", e), Some(1006));
            }
        }
    };

    finish(&inner, &id, generation);
    emit(WsEvent::Status {
        id,
        connected: false,
        message: Some(message),
        code,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::sync::mpsc::channel;
    use std::time::Instant;
    use tungstenite::handshake::server::{ErrorResponse, Request, Response};

    fn protos() -> Vec<String> {
        vec![
            "hermes-gateway-v1".to_string(),
            "hermes-gateway-ticket.abc123".to_string(),
        ]
    }

    #[test]
    fn validate_accepts_announced_loopback_gateway() {
        let ok = validate_dial(
            "ws://127.0.0.1:55057/api/ws?native_dial=u1",
            &protos(),
            Some(55057),
        );
        assert!(ok.is_ok(), "{:?}", ok);
        assert!(validate_dial("ws://localhost:55057/api/ws", &protos(), Some(55057)).is_ok());
        assert!(validate_dial("ws://[::1]:55057/api/ws", &protos(), Some(55057)).is_ok());
    }

    #[test]
    fn validate_rejects_everything_else() {
        let p = protos();
        // not loopback / not ws
        assert!(validate_dial("ws://example.com:55057/api/ws", &p, Some(55057)).is_err());
        assert!(validate_dial("ws://192.168.1.5:55057/api/ws", &p, Some(55057)).is_err());
        assert!(validate_dial("wss://127.0.0.1:55057/api/ws", &p, Some(55057)).is_err());
        assert!(validate_dial("http://127.0.0.1:55057/api/ws", &p, Some(55057)).is_err());
        // userinfo trick
        assert!(validate_dial("ws://127.0.0.1:1@evil.com:55057/api/ws", &p, Some(55057)).is_err());
        // wrong port / no announced port
        assert!(validate_dial("ws://127.0.0.1:8080/api/ws", &p, Some(55057)).is_err());
        assert!(validate_dial("ws://127.0.0.1:55057/api/ws", &p, None).is_err());
        // wrong path
        assert!(validate_dial("ws://127.0.0.1:55057/api/other", &p, Some(55057)).is_err());
        assert!(validate_dial("ws://127.0.0.1:55057/", &p, Some(55057)).is_err());
        // subprotocols
        let url = "ws://127.0.0.1:55057/api/ws";
        assert!(validate_dial(url, &[], Some(55057)).is_err());
        assert!(validate_dial(url, &["evil".to_string()], Some(55057)).is_err());
        assert!(validate_dial(url, &["hermes-gateway-ticket.".to_string()], Some(55057)).is_err());
        assert!(
            validate_dial(url, &["hermes-gateway-ticket.a b".to_string()], Some(55057)).is_err()
        );
        let three = vec!["hermes-gateway-v1".to_string(); 3];
        assert!(validate_dial(url, &three, Some(55057)).is_err());
    }

    #[test]
    fn ws_url_port_and_ticket_split() {
        assert_eq!(ws_url_port("ws://127.0.0.1:55057/api/ws?x=1"), Some(55057));
        assert_eq!(ws_url_port("http://127.0.0.1:1/api/ws"), None);
        let (url, t) =
            parse_ticket_url("ws://127.0.0.1:5/api/ws?native_dial=u&ticket=TKT").unwrap();
        assert_eq!(url, "ws://127.0.0.1:5/api/ws?native_dial=u");
        assert_eq!(t, "TKT");
        assert!(parse_ticket_url("ws://127.0.0.1:5/api/ws").is_err());
    }

    // ---- loopback fake gateway -------------------------------------------

    fn collecting_emit() -> (Emit, Receiver<WsEvent>) {
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        let emit: Emit = Arc::new(move |ev| {
            if let Ok(g) = tx.lock() {
                let _ = g.send(ev);
            }
        });
        (emit, rx)
    }

    /// Accepts any number of connections, negotiates `hermes-gateway-v1`,
    /// sends a `ready` frame and echoes text frames as `echo:<text>`.
    fn start_fake_gateway() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        thread::spawn(move || {
            for stream in listener.incoming() {
                let stream = match stream {
                    Ok(s) => s,
                    Err(_) => break,
                };
                thread::spawn(move || {
                    let cb = |_req: &Request, mut resp: Response| -> Result<Response, ErrorResponse> {
                        resp.headers_mut().insert(
                            SEC_WEBSOCKET_PROTOCOL,
                            HeaderValue::from_static("hermes-gateway-v1"),
                        );
                        Ok(resp)
                    };
                    let mut ws = match tungstenite::accept_hdr(stream, cb) {
                        Ok(w) => w,
                        Err(_) => return,
                    };
                    let _ = ws.send(Message::Text("ready".to_string().into()));
                    loop {
                        match ws.read() {
                            Ok(Message::Text(t)) => {
                                let reply = format!("echo:{}", t);
                                if ws.send(Message::Text(reply.into())).is_err() {
                                    break;
                                }
                            }
                            Ok(Message::Close(_)) | Err(_) => break,
                            Ok(_) => {}
                        }
                    }
                });
            }
        });
        port
    }

    fn wait_for(rx: &Receiver<WsEvent>, what: &str, pred: impl Fn(&WsEvent) -> bool) {
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            match rx.recv_timeout(left) {
                Ok(ev) => {
                    if pred(&ev) {
                        return;
                    }
                }
                Err(_) => panic!("timeout waiting for: {}", what),
            }
        }
    }

    fn frame_is(ev: &WsEvent, want_id: &str, want: &str) -> bool {
        match ev {
            WsEvent::Frame { id, data } => id.as_str() == want_id && data.as_str() == want,
            _ => false,
        }
    }

    fn dial_url(port: u16) -> String {
        format!("ws://127.0.0.1:{}/api/ws?native_dial=t", port)
    }

    #[test]
    fn outbound_is_not_delayed_by_the_read_timeout() {
        let port = start_fake_gateway();
        let bridge = WsBridge::new();
        bridge.allow_port(port);
        let (emit, rx) = collecting_emit();
        bridge
            .open(emit, "s1", &dial_url(port), &protos())
            .expect("open");
        wait_for(&rx, "ready frame", |e| frame_is(e, "s1", "ready"));

        let t0 = Instant::now();
        bridge.send_to("s1", "ping".to_string()).unwrap();
        wait_for(&rx, "echo", |e| frame_is(e, "s1", "echo:ping"));
        let dt = t0.elapsed();
        // Spike 1 skeleton: up to ~1 s. Now: a few tens of ms.
        assert!(
            dt < Duration::from_millis(400),
            "outbound latency too high: {:?}",
            dt
        );
        bridge.close_id("s1").unwrap();
    }

    #[test]
    fn sessions_are_independent() {
        let port = start_fake_gateway();
        let bridge = WsBridge::new();
        bridge.allow_port(port);
        let (emit, rx) = collecting_emit();
        bridge
            .open(emit.clone(), "a", &dial_url(port), &protos())
            .expect("open a");
        bridge
            .open(emit, "b", &dial_url(port), &protos())
            .expect("open b");
        wait_for(&rx, "ready a", |e| frame_is(e, "a", "ready"));
        wait_for(&rx, "ready b", |e| frame_is(e, "b", "ready"));

        bridge.send_to("a", "1".to_string()).unwrap();
        wait_for(&rx, "echo a", |e| frame_is(e, "a", "echo:1"));

        // closing `a` must not touch `b`
        bridge.close_id("a").unwrap();
        wait_for(&rx, "status a closed", |e| {
            matches!(e, WsEvent::Status { id, connected: false, .. } if id.as_str() == "a")
        });
        assert!(bridge.is_session_open("b"));
        bridge.send_to("b", "2".to_string()).unwrap();
        wait_for(&rx, "echo b", |e| frame_is(e, "b", "echo:2"));
        assert!(bridge.send_to("a", "x".to_string()).is_err());
        bridge.close_all();
    }

    #[test]
    fn open_refuses_unannounced_port_without_dialing() {
        let bridge = WsBridge::new();
        let (emit, _rx) = collecting_emit();
        // nothing announced yet
        assert!(bridge
            .open(emit.clone(), "x", "ws://127.0.0.1:9/api/ws", &protos())
            .is_err());
        bridge.allow_port(55057);
        // announced port differs
        assert!(bridge
            .open(emit, "x", "ws://127.0.0.1:9/api/ws", &protos())
            .is_err());
    }

    #[test]
    fn server_side_close_is_reported_with_code() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        thread::spawn(move || {
            if let Ok((stream, _)) = listener.accept() {
                let cb = |_r: &Request, mut resp: Response| -> Result<Response, ErrorResponse> {
                    resp.headers_mut().insert(
                        SEC_WEBSOCKET_PROTOCOL,
                        HeaderValue::from_static("hermes-gateway-v1"),
                    );
                    Ok(resp)
                };
                if let Ok(mut ws) = tungstenite::accept_hdr(stream, cb) {
                    let _ = ws.close(None);
                    let _ = ws.flush();
                    // keep reading so the close handshake completes
                    while ws.read().is_ok() {}
                }
            }
        });
        let bridge = WsBridge::new();
        bridge.allow_port(port);
        let (emit, rx) = collecting_emit();
        bridge
            .open(emit, "c", &dial_url(port), &protos())
            .expect("open");
        wait_for(&rx, "closed status", |e| {
            matches!(e, WsEvent::Status { id, connected: false, code: Some(_), .. } if id.as_str() == "c")
        });
        assert!(!bridge.is_session_open("c"));
    }
}
