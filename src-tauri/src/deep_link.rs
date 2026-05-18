use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use url::Url;

pub struct DeepLinkState {
    pending_request: Arc<Mutex<Option<String>>>,
}

impl Default for DeepLinkState {
    fn default() -> Self {
        Self {
            pending_request: Arc::new(Mutex::new(None)),
        }
    }
}

impl DeepLinkState {
    pub fn store(&self, payload: String) {
        *self.pending_request.lock().unwrap() = Some(payload);
    }

    pub fn take(&self) -> Option<String> {
        self.pending_request.lock().unwrap().take()
    }

    pub fn peek(&self) -> Option<String> {
        self.pending_request.lock().unwrap().clone()
    }
}

struct ParsedRequest {
    request: Value,
    callback: Option<String>,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn validate(uri_str: &str) -> Result<ParsedRequest, String> {
    let url = Url::parse(uri_str).map_err(|e| format!("invalid URI: {e}"))?;

    if url.scheme() != "sigil" {
        return Err("not a sigil:// URI".into());
    }
    if url.host_str() != Some("v1") || url.path() != "/request" {
        return Err("expected sigil://v1/request".into());
    }

    let mut d_param: Option<String> = None;
    let mut cb_param: Option<String> = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "d" => d_param = Some(v.into_owned()),
            "cb" => cb_param = Some(v.into_owned()),
            _ => {}
        }
    }

    let d = d_param.ok_or("missing 'd' parameter")?;

    let bytes = URL_SAFE_NO_PAD
        .decode(&d)
        .map_err(|e| format!("base64url decode failed: {e}"))?;

    let json_str =
        String::from_utf8(bytes).map_err(|_| "payload is not valid UTF-8".to_string())?;

    let value: Value =
        serde_json::from_str(&json_str).map_err(|e| format!("JSON parse failed: {e}"))?;

    // Required fields
    let req_type = value["type"]
        .as_str()
        .ok_or("missing 'type' field")?;

    if !["transfer", "sc_call", "sign_message", "connect"].contains(&req_type) {
        return Err(format!("unknown request type: {req_type}"));
    }

    let nonce = value["nonce"].as_str().ok_or("missing 'nonce' field")?;
    if nonce.len() < 8 {
        return Err("nonce too short (min 8 chars)".into());
    }

    let dapp_origin = value["dapp"]["origin"]
        .as_str()
        .ok_or("missing 'dapp.origin'")?;
    Url::parse(dapp_origin).map_err(|_| format!("invalid dapp.origin: {dapp_origin}"))?;

    // Expiry check
    if let Some(exp) = value["exp"].as_u64() {
        if exp <= now_secs() {
            return Err("request has expired".into());
        }
    }

    // Type-specific checks
    match req_type {
        "transfer" => {
            let to = value["to"].as_str().ok_or("transfer: missing 'to'")?;
            if to.len() != 60 {
                return Err(format!(
                    "transfer: 'to' must be 60 chars, got {}",
                    to.len()
                ));
            }
            let amount = value["amount"].as_i64().ok_or("transfer: missing 'amount'")?;
            if amount <= 0 {
                return Err("transfer: 'amount' must be positive".into());
            }
        }
        "sc_call" => {
            let idx = value["contract_index"]
                .as_i64()
                .ok_or("sc_call: missing 'contract_index'")?;
            if !(0..=63).contains(&idx) {
                return Err(format!("sc_call: 'contract_index' out of range: {idx}"));
            }
            let input_type = value["input_type"]
                .as_i64()
                .ok_or("sc_call: missing 'input_type'")?;
            if input_type < 0 {
                return Err("sc_call: 'input_type' must be non-negative".into());
            }
        }
        "sign_message" => {
            let msg = value["message"]
                .as_str()
                .ok_or("sign_message: missing 'message'")?;
            if msg.is_empty() {
                return Err("sign_message: 'message' must not be empty".into());
            }
        }
        // "connect" — no extra required fields
        _ => {}
    }

    Ok(ParsedRequest {
        request: value,
        callback: cb_param,
    })
}

pub fn register_handler(app: &AppHandle) {
    let handle = app.clone();

    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            let raw = url.to_string();

            if !raw.starts_with("sigil://") {
                continue;
            }

            match validate(&raw) {
                Ok(parsed) => {
                    let envelope = serde_json::json!({
                        "request": parsed.request,
                        "callback": parsed.callback,
                    });
                    let payload = envelope.to_string();
                    let state = handle.state::<DeepLinkState>();
                    state.store(payload.clone());
                    handle.emit("sigil:request", payload).ok();
                }
                Err(e) => {
                    eprintln!("[sigil] deep link rejected: {e}");
                }
            }
        }
    });
}
