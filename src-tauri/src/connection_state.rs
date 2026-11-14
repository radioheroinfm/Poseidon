//! Active connection route + last ensure snapshot (Epoch 3 P0).

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActiveRoute {
    pub connection_id: Option<String>,
    pub profile: Option<String>,
    pub registry_scoped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    pub kind: String,
    pub state: String,
    pub api_origin: Option<String>,
    pub instance_id: Option<String>,
    pub profile_id: Option<String>,
    pub ws_url: Option<String>,
    pub code_sha: Option<String>,
    pub supervisor: Option<String>,
    pub message: Option<String>,
}

impl Default for ConnectionInfo {
    fn default() -> Self {
        Self {
            kind: "none".into(),
            state: "idle".into(),
            api_origin: None,
            instance_id: None,
            profile_id: None,
            ws_url: None,
            code_sha: None,
            supervisor: None,
            message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootProgress {
    pub phase: String,
    pub ready: bool,
    pub detail: Option<String>,
    pub percent: Option<u8>,
}

pub struct ConnectionState {
    pub route: Mutex<ActiveRoute>,
    pub last: Mutex<ConnectionInfo>,
    pub boot: Mutex<BootProgress>,
}

impl ConnectionState {
    pub fn new() -> Self {
        Self {
            route: Mutex::new(ActiveRoute::default()),
            last: Mutex::new(ConnectionInfo::default()),
            boot: Mutex::new(BootProgress {
                phase: "poseidon-shell".into(),
                ready: true,
                detail: Some("shell up".into()),
                percent: Some(100),
            }),
        }
    }

    pub fn set_route(&self, route: ActiveRoute) {
        if let Ok(mut g) = self.route.lock() {
            *g = route;
        }
    }

    pub fn get_route(&self) -> ActiveRoute {
        self.route.lock().map(|g| g.clone()).unwrap_or_default()
    }

    pub fn set_last(&self, info: ConnectionInfo) {
        if let Ok(mut g) = self.last.lock() {
            *g = info;
        }
    }

    pub fn get_last(&self) -> ConnectionInfo {
        self.last.lock().map(|g| g.clone()).unwrap_or_default()
    }

    pub fn set_boot(&self, boot: BootProgress) {
        if let Ok(mut g) = self.boot.lock() {
            *g = boot;
        }
    }

    pub fn get_boot(&self) -> BootProgress {
        self.boot.lock().map(|g| g.clone()).unwrap_or(BootProgress {
            phase: "unknown".into(),
            ready: false,
            detail: None,
            percent: None,
        })
    }
}
