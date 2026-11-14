//! Local Hermes gateway discovery via `hermes gateway ensure --json`
//! and session-ticket mint over ~/.hermes/gateway.sock
//!
//! Facts: docs/upstream/HERMES_FACTS_2026-11-14.md
//!        docs/upstream/ENSURE_AND_TICKET_2026-11-14.md

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use log::{info, debug};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EnsureEndpoint {
    pub api_origin: String,
    pub instance_id: String,
    pub profile_id: String,
    #[serde(default)]
    pub control_home: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub code_sha: Option<String>,
    #[serde(default)]
    pub runtime_protocol: Option<u32>,
    #[serde(default)]
    pub supervisor: Option<String>,
    #[serde(default)]
    pub authority_epoch: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EnsurePayload {
    pub state: String,
    #[serde(default)]
    pub endpoint: Option<EnsureEndpoint>,
    #[serde(default)]
    pub reason_code: Option<String>,
    #[serde(default)]
    pub detail: Option<serde_json::Value>,
    #[serde(default)]
    pub client_code_sha: Option<String>,
}

fn hermes_home() -> PathBuf {
    if let Ok(h) = std::env::var("HERMES_HOME") {
        let h = h.trim();
        if !h.is_empty() {
            return PathBuf::from(h);
        }
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".hermes")
}

fn find_hermes_bin() -> PathBuf {
    if let Ok(p) = which::which("hermes") {
        return p;
    }
    if let Some(home) = dirs::home_dir() {
        for cand in [
            home.join(".hermes/bin/hermes"),
            home.join(".local/bin/hermes"),
            home.join("hermes-agent/.venv/bin/hermes"),
        ] {
            if cand.exists() {
                return cand;
            }
        }
    }
    PathBuf::from("hermes")
}

/// Run `hermes gateway ensure --json` and parse endpoint.
pub fn gateway_ensure_json() -> Result<EnsurePayload, String> {
    let bin = find_hermes_bin();
    let home = hermes_home();
    info!("gateway ensure --json via {:?} HERMES_HOME={:?}", bin, home);

    let output = Command::new(&bin)
        .args(["gateway", "ensure", "--json"])
        .env("HERMES_HOME", &home)
        .output()
        .map_err(|e| format!("spawn hermes gateway ensure: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "hermes gateway ensure failed ({}): {}",
            output.status, stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();
    if let Ok(p) = serde_json::from_str::<EnsurePayload>(trimmed) {
        return Ok(p);
    }
    // Fallback: last JSON-looking line
    let line = stdout
        .lines()
        .rev()
        .map(str::trim)
        .find(|l| l.starts_with('{'))
        .ok_or_else(|| format!("no JSON in ensure stdout: {}", stdout))?;

    serde_json::from_str(line).map_err(|e| format!("parse ensure JSON: {} ({})", e, line))
}

fn resolve_sock_path(home: &Path) -> PathBuf {
    let pointer = home.join("gateway.sock.path");
    if pointer.exists() {
        if let Ok(p) = std::fs::read_to_string(&pointer) {
            let p = p.trim();
            if !p.is_empty() {
                return PathBuf::from(p);
            }
        }
    }
    home.join("gateway.sock")
}

/// Mint one-use session ticket via control socket.
pub fn mint_session_ticket(
    instance_id: &str,
    profile_id: &str,
) -> Result<String, String> {
    let home = hermes_home();
    let sock = resolve_sock_path(&home);
    if !sock.exists() {
        return Err(format!("gateway.sock not found at {:?}", sock));
    }

    let req = serde_json::json!({
        "protocol": 1,
        "id": 1,
        "verb": "session-ticket",
        "params": {
            "profile_id": profile_id,
            "instance_id": instance_id,
            "purpose": "interactive",
            "scope": "host"
        }
    });

    let mut stream = UnixStream::connect(&sock)
        .map_err(|e| format!("connect {:?}: {}", sock, e))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .ok();

    let body = req.to_string() + "\n";
    stream
        .write_all(body.as_bytes())
        .map_err(|e| format!("write ticket request: {}", e))?;

    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|e| format!("read ticket reply: {}", e))?;

    debug!("ticket reply received ({} bytes)", line.trim().len());

    let reply: serde_json::Value = serde_json::from_str(line.trim())
        .map_err(|e| format!("parse ticket reply: {}", e))?;

    if reply.get("protocol").and_then(|v| v.as_u64()) != Some(1) {
        return Err("ticket reply protocol != 1".into());
    }
    if reply.get("id").and_then(|v| v.as_u64()) != Some(1) {
        return Err("ticket reply id != 1".into());
    }
    if reply.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        return Err(format!(
            "ticket denied: {}",
            reply.get("error").and_then(|e| e.as_str()).unwrap_or("unknown")
        ));
    }

    let grant = reply
        .get("result")
        .ok_or_else(|| "ticket reply missing result".to_string())?;

    let ticket = grant
        .get("ticket")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "ticket reply missing result.ticket".to_string())?;

    if let Some(iid) = grant.get("instance_id").and_then(|v| v.as_str()) {
        if iid != instance_id {
            return Err(format!(
                "ticket instance_id mismatch: {} != {}",
                iid, instance_id
            ));
        }
    }
    if let Some(pid) = grant.get("profile_id").and_then(|v| v.as_str()) {
        if pid != profile_id {
            return Err(format!(
                "ticket profile_id mismatch: {} != {}",
                pid, profile_id
            ));
        }
    }

    Ok(ticket.to_string())
}

/// api_origin "http://127.0.0.1:55057" → ws base
pub fn api_origin_to_ws_base(api_origin: &str) -> Result<String, String> {
    let u = api_origin.trim_end_matches('/');
    if let Some(rest) = u.strip_prefix("https://") {
        Ok(format!("wss://{}", rest))
    } else if let Some(rest) = u.strip_prefix("http://") {
        Ok(format!("ws://{}", rest))
    } else {
        Err(format!("unsupported api_origin: {}", api_origin))
    }
}

/// Full local dial URL with fresh ticket.
pub fn mint_local_ws_url() -> Result<String, String> {
    let payload = gateway_ensure_json()?;
    if payload.state != "ready" {
        return Err(format!(
            "gateway not ready: state={} reason={:?}",
            payload.state, payload.reason_code
        ));
    }
    let ep = payload
        .endpoint
        .ok_or_else(|| "ensure ready but no endpoint".to_string())?;

    let ticket = mint_session_ticket(&ep.instance_id, &ep.profile_id)?;
    let base = api_origin_to_ws_base(&ep.api_origin)?;
    let nonce = uuid_v4_simple();
    let url = format!(
        "{}/api/ws?native_dial={}&ticket={}",
        base,
        nonce,
        url_encode(&ticket)
    );
    info!("minted local WS dial for instance {}", ep.instance_id);
    Ok(url)
}

fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn uuid_v4_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:032x}", t ^ (t >> 17))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_origin_http() {
        assert_eq!(
            api_origin_to_ws_base("http://127.0.0.1:55057").unwrap(),
            "ws://127.0.0.1:55057"
        );
    }

    #[test]
    fn parse_ensure_fixture() {
        let j = r#"{"state":"ready","endpoint":{"api_origin":"http://127.0.0.1:55057","instance_id":"abc","profile_id":"/home/t/.hermes","capabilities":[]}}"#;
        let p: EnsurePayload = serde_json::from_str(j).unwrap();
        assert_eq!(p.state, "ready");
        assert_eq!(p.endpoint.unwrap().api_origin, "http://127.0.0.1:55057");
    }
}
