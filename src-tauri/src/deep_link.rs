use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_store::StoreExt;
use url::Url;

const NONCE_STORE_PATH: &str = "glyph-security.json";
const NONCE_STORE_KEY: &str = "seen_nonces";
const MAX_NONCE_AGE_SECS: u64 = 3600;
const MAX_SIGN_MESSAGE_LEN: usize = 2048;
const MAX_PENDING_LINKS: usize = 16;
// The relay is the only trusted cross-origin callback transport. Its exact
// origin and callback route remain constrained below, including a bounded nonce.
const OFFICIAL_RELAY_ORIGIN: &str = "https://relay.glyphq.org";

pub struct DeepLinkState {
    pending_requests: Arc<Mutex<VecDeque<String>>>,
    pending_payments: Arc<Mutex<VecDeque<String>>>,
    /// Maps nonce → unix timestamp of first receipt for time-bounded replay protection.
    seen_nonces: Arc<Mutex<HashMap<String, u64>>>,
}

impl Default for DeepLinkState {
    fn default() -> Self {
        Self {
            pending_requests: Arc::new(Mutex::new(VecDeque::new())),
            pending_payments: Arc::new(Mutex::new(VecDeque::new())),
            seen_nonces: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl DeepLinkState {
    pub fn store(&self, payload: String) {
        Self::store_bounded(&self.pending_requests, payload);
    }

    pub fn take(&self) -> Option<String> {
        self.pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .pop_front()
    }

    pub fn peek(&self) -> Option<String> {
        self.pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .front()
            .cloned()
    }

    pub fn store_payment(&self, payload: String) {
        Self::store_bounded(&self.pending_payments, payload);
    }

    pub fn take_payment(&self) -> Option<String> {
        self.pending_payments
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .pop_front()
    }

    fn store_bounded(queue: &Mutex<VecDeque<String>>, payload: String) {
        let mut queue = queue.lock().unwrap_or_else(|e| e.into_inner());
        if queue.len() == MAX_PENDING_LINKS {
            queue.pop_front();
        }
        queue.push_back(payload);
    }

    fn prune_seen_nonces(seen: &mut HashMap<String, u64>, now: u64) {
        seen.retain(|_, &mut inserted_at| now.saturating_sub(inserted_at) < MAX_NONCE_AGE_SECS);
    }

    pub fn load_seen_nonces(&self, app: &AppHandle) {
        let Ok(store) = app.store(NONCE_STORE_PATH) else {
            return;
        };
        let Some(value) = store.get(NONCE_STORE_KEY) else {
            return;
        };
        let Ok(mut seen) = serde_json::from_value::<HashMap<String, u64>>(value) else {
            return;
        };
        Self::prune_seen_nonces(&mut seen, now_secs());
        *self.seen_nonces.lock().unwrap_or_else(|e| e.into_inner()) = seen;
    }

    fn persist_seen_nonces(&self, app: &AppHandle) {
        let Ok(store) = app.store(NONCE_STORE_PATH) else {
            return;
        };
        let seen = self
            .seen_nonces
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        if let Ok(value) = serde_json::to_value(seen) {
            store.set(NONCE_STORE_KEY, value);
            let _ = store.save();
        }
    }

    /// Returns false if the nonce was already seen within the last hour (replay), true if fresh.
    pub fn record_nonce(&self, app: &AppHandle, nonce: &str) -> bool {
        let mut seen = self.seen_nonces.lock().unwrap_or_else(|e| e.into_inner());
        let now = now_secs();
        Self::prune_seen_nonces(&mut seen, now);
        if seen.contains_key(nonce) {
            return false;
        }
        seen.insert(nonce.to_string(), now);
        drop(seen);
        self.persist_seen_nonces(app);
        true
    }
}

struct ParsedRequest {
    request: Value,
    nonce: String,
    callback: Option<String>,
    redirect_uri: Option<String>,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn parse_positive_i64(value: &Value) -> Option<i64> {
    if let Some(number) = value.as_i64() {
        return Some(number);
    }
    value.as_str()?.parse::<i64>().ok()
}

fn is_official_relay_callback(url: &Url) -> bool {
    if url.origin().ascii_serialization() != OFFICIAL_RELAY_ORIGIN
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return false;
    }

    let Some(nonce) = url.path().strip_prefix("/v1/callback/") else {
        return false;
    };
    nonce.len() >= 16
        && nonce.len() <= 128
        && nonce
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn validate_delivery_url(
    url_str: &str,
    field: &str,
    claimed_origin: &str,
    allow_official_relay: bool,
) -> Result<(), String> {
    let url = Url::parse(url_str).map_err(|_| format!("invalid {field} URL"))?;
    let host = url.host_str().unwrap_or("");
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err(format!("{field} must use HTTPS without embedded credentials"));
    }
    if crate::commands::is_private_host(host) {
        return Err(format!("{field} must not target a non-global address"));
    }
    if url.origin().ascii_serialization() != claimed_origin
        && !(allow_official_relay && is_official_relay_callback(&url))
    {
        return Err(format!("{field} origin must match dapp.origin"));
    }
    Ok(())
}

fn validate_dapp_origin(origin: &str) -> Result<String, String> {
    let parsed = Url::parse(origin).map_err(|_| format!("invalid dapp.origin: {origin}"))?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("dapp.origin must be a credential-free HTTPS origin".into());
    }

    Ok(parsed.origin().ascii_serialization())
}

fn validate(uri_str: &str) -> Result<ParsedRequest, String> {
    let url = Url::parse(uri_str).map_err(|e| format!("invalid URI: {e}"))?;

    if crate::link_broker::validate_launch_url(uri_str)
        != Ok(crate::link_broker::LinkKind::Request)
    {
        return Err("expected glyph://v1/request".into());
    }

    let mut d_param: Option<String> = None;
    let mut cb_param: Option<String> = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "d" if d_param.is_none() => d_param = Some(v.into_owned()),
            "cb" if cb_param.is_none() => cb_param = Some(v.into_owned()),
            "d" | "cb" => return Err("duplicate query parameters are not allowed".into()),
            _ => {}
        }
    }

    let d = d_param.ok_or("missing 'd' parameter")?;

    if d.len() > 8192 {
        return Err("payload too large (max 8192 bytes base64)".into());
    }

    let bytes = URL_SAFE_NO_PAD
        .decode(&d)
        .map_err(|e| format!("base64url decode failed: {e}"))?;

    let json_str =
        String::from_utf8(bytes).map_err(|_| "payload is not valid UTF-8".to_string())?;

    let value: Value =
        serde_json::from_str(&json_str).map_err(|e| format!("JSON parse failed: {e}"))?;

    let (request_value, callback_from_payload, redirect_uri_from_payload) = match value.get("request") {
        Some(request) if request.is_object() => (
            request.clone(),
            value.get("callback").and_then(|v| v.as_str()).map(|s| s.to_string()),
            value.get("redirect_uri").and_then(|v| v.as_str()).map(|s| s.to_string()),
        ),
        _ => (value.clone(), None, None),
    };

    // Required fields
    let req_type = request_value["type"].as_str().ok_or("missing 'type' field")?;

    if ![
        "transfer",
        "sc_call",
        "sign_message",
        "verify_message",
        "connect",
    ]
    .contains(&req_type)
    {
        return Err(format!("unknown request type: {req_type}"));
    }

    let nonce = request_value["nonce"].as_str().ok_or("missing 'nonce' field")?;
    if nonce.len() < 16 || nonce.len() > 128 {
        return Err("nonce must be 16–128 characters".into());
    }
    if !nonce
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'=' | b'+'))
    {
        return Err("nonce must use a base64url-safe or alphanumeric charset".into());
    }

    let dapp_origin = request_value["dapp"]["origin"]
        .as_str()
        .ok_or("missing 'dapp.origin'")?;
    let claimed_origin = validate_dapp_origin(dapp_origin)?;

    // Expiry check: missing exp defaults to 5 minutes from receipt; exp too far in
    // the future is clamped so dApps cannot create permanent requests.
    let now = now_secs();
    let exp = request_value["exp"].as_u64().unwrap_or_else(|| now + 300);
    if exp <= now {
        return Err("request has expired".into());
    }
    if exp > now + MAX_NONCE_AGE_SECS {
        return Err("request expiry too far in the future (max 1 hour)".into());
    }

    // Validate callback URL if present
    let callback = match (callback_from_payload, cb_param) {
        (Some(from_payload), Some(from_query)) if from_payload != from_query => {
            return Err("callback URL mismatch between payload and query parameter".into())
        }
        (Some(from_payload), _) => Some(from_payload),
        (None, from_query) => from_query,
    };

    if let Some(cb) = &callback {
        validate_delivery_url(cb, "callback URL", &claimed_origin, true)?;
    }

    let redirect_uri = redirect_uri_from_payload;
    if let Some(ru) = &redirect_uri {
        validate_delivery_url(ru, "redirect_uri", &claimed_origin, false)?;
    }

    // Type-specific checks
    match req_type {
        "transfer" => {
            let to = request_value["to"].as_str().ok_or("transfer: missing 'to'")?;
            if crate::qubic_native::identity_to_public_key(to).is_err() {
                let preview: String = to.chars().take(8).collect();
                return Err(format!(
                    "transfer: 'to' must be a valid Qubic identity, got '{}'",
                    preview
                ));
            }
            let amount = parse_positive_i64(&request_value["amount"])
                .ok_or("transfer: missing 'amount'")?;
            if amount <= 0 {
                return Err("transfer: 'amount' must be positive".into());
            }
        }
        "sc_call" => {
            let idx = request_value["contract_index"]
                .as_i64()
                .ok_or("sc_call: missing 'contract_index'")?;
            if !(0..=63).contains(&idx) {
                return Err(format!("sc_call: 'contract_index' out of range: {idx}"));
            }
            let input_type = request_value["input_type"]
                .as_i64()
                .ok_or("sc_call: missing 'input_type'")?;
            if input_type < 0 {
                return Err("sc_call: 'input_type' must be non-negative".into());
            }
            if let Some(amount) = request_value.get("amount") {
                let amount = parse_positive_i64(amount)
                    .ok_or("sc_call: 'amount' must be an integer")?;
                if amount < 0 {
                    return Err("sc_call: 'amount' must be non-negative".into());
                }
            }
        }
        "sign_message" => {
            let msg = request_value["message"]
                .as_str()
                .ok_or("sign_message: missing 'message'")?;
            if msg.is_empty() {
                return Err("sign_message: 'message' must not be empty".into());
            }
            if msg.chars().count() > MAX_SIGN_MESSAGE_LEN {
                return Err("sign_message: 'message' exceeds 2048 characters".into());
            }
        }
        "verify_message" => {
            let msg = request_value["message"]
                .as_str()
                .ok_or("verify_message: missing 'message'")?;
            if msg.is_empty() {
                return Err("verify_message: 'message' must not be empty".into());
            }
            request_value["signature"]
                .as_str()
                .ok_or("verify_message: missing 'signature'")?;
            request_value["public_key"]
                .as_str()
                .ok_or("verify_message: missing 'public_key'")?;
        }
        // "connect" — no extra required fields
        _ => {}
    }

    Ok(ParsedRequest {
        nonce: nonce.to_string(),
        request: request_value,
        callback,
        redirect_uri,
    })
}

struct PayRequest {
    to: String,
    amount: Option<String>,
    label: Option<String>,
}

fn validate_pay(uri_str: &str) -> Result<PayRequest, String> {
    let url = Url::parse(uri_str).map_err(|e| format!("invalid URI: {e}"))?;
    if crate::link_broker::validate_launch_url(uri_str) != Ok(crate::link_broker::LinkKind::Pay) {
        return Err("not a glyph://pay URI".into());
    }

    let mut to: Option<String> = None;
    let mut amount: Option<String> = None;
    let mut label: Option<String> = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "to" if to.is_none() => to = Some(v.into_owned()),
            "amount" if amount.is_none() => amount = Some(v.into_owned()),
            "label" if label.is_none() => label = Some(v.into_owned().chars().take(200).collect()),
            "to" | "amount" | "label" => {
                return Err("duplicate query parameters are not allowed".into())
            }
            _ => {}
        }
    }

    let to = to.ok_or("missing 'to' parameter")?;
    if crate::qubic_native::identity_to_public_key(&to).is_err() {
        return Err(format!("invalid identity in 'to': {}", &to[..to.len().min(8)]));
    }
    if let Some(ref a) = amount {
        let n: i64 = a.parse().map_err(|_| "amount is not a valid integer")?;
        if n <= 0 {
            return Err("amount must be positive".into());
        }
    }

    Ok(PayRequest { to, amount, label })
}

pub fn process_url(app: &AppHandle, raw: &str) -> bool {
    let kind = match crate::link_broker::validate_launch_url(raw) {
        Ok(kind) => kind,
        Err(error) => {
            eprintln!("[glyph] launch link rejected: {error}");
            return false;
        }
    };

    if kind == crate::link_broker::LinkKind::Pay {
        match validate_pay(raw) {
            Ok(pay) => {
                let payload = serde_json::json!({
                    "to": pay.to,
                    "amount": pay.amount,
                    "label": pay.label,
                });
                let payload = payload.to_string();
                app.state::<DeepLinkState>().store_payment(payload);
                app.emit("glyph:pay", ()).ok();
                return true;
            }
            Err(e) => {
                eprintln!("[glyph] pay link rejected: {e}");
            }
        }
        return false;
    }

    match validate(raw) {
        Ok(parsed) => {
            let state = app.state::<DeepLinkState>();
            if !state.record_nonce(app, &parsed.nonce) {
                eprintln!(
                    "[glyph] deep link rejected: duplicate nonce '{}'",
                    parsed.nonce
                );
                return false;
            }
            let envelope = serde_json::json!({
                "request": parsed.request,
                "callback": parsed.callback,
                "redirect_uri": parsed.redirect_uri,
            });
            let payload = envelope.to_string();
            state.store(payload.clone());
            app.emit("glyph:request", payload).ok();
            true
        }
        Err(e) => {
            eprintln!("[glyph] deep link rejected: {e}");
            false
        }
    }
}

pub fn register_handler(app: &AppHandle) {
    app.state::<DeepLinkState>().load_seen_nonces(app);

    if let Ok(Some(urls)) = app.deep_link().get_current() {
        for url in urls {
            process_url(app, &url.to_string());
        }
    }

    let handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            process_url(&handle, &url.to_string());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        now_secs, validate, validate_dapp_origin, validate_delivery_url, validate_pay, DeepLinkState,
        MAX_PENDING_LINKS,
    };

    #[test]
    fn rejects_shell_like_deep_link_paths() {
        let malicious_urls = [
            "glyph://path/to/bash&MaliciousCommand",
            "glyph://path/to/bash?cmd=MaliciousCommand",
            "glyph:///bin/bash?cmd=MaliciousCommand",
            "glyph://v1/bin/bash?cmd=MaliciousCommand",
            "glyph://v1/request/bin/bash?cmd=MaliciousCommand",
            "glyph://pay/bin/bash?cmd=MaliciousCommand",
        ];

        for url in malicious_urls {
            assert!(validate(url).is_err(), "request parser accepted {url}");
            assert!(validate_pay(url).is_err(), "pay parser accepted {url}");
        }
    }

    #[test]
    fn rejects_encoded_path_and_authority_injection() {
        let malicious_urls = [
            "glyph://v1/%2e%2e/%2e%2e/bin/bash?cmd=MaliciousCommand",
            "glyph://v1/request%2f..%2f..%2fbin%2fbash?cmd=MaliciousCommand",
            "glyph://v1@evil.example/request?cmd=MaliciousCommand",
            "glyph://pay@evil.example/?to=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ];

        for url in malicious_urls {
            assert!(validate(url).is_err(), "request parser accepted {url}");
            assert!(validate_pay(url).is_err(), "pay parser accepted {url}");
        }
    }

    #[test]
    fn parsers_reject_duplicate_query_parameters_directly() {
        assert!(validate("glyph://v1/request?d=YWJjZA&d=ZGVm").is_err());
        assert!(validate(
            "glyph://v1/request?d=YWJjZA&cb=https%3A%2F%2Fdemo.app%2Fcb&cb=https%3A%2F%2Fdemo.app%2Fother"
        )
        .is_err());
        assert!(validate_pay(
            "glyph://pay?to=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&to=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        )
        .is_err());
        assert!(validate_pay(
            "glyph://pay?to=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&amount=1&amount=2"
        )
        .is_err());
    }

    #[test]
    fn parsers_reject_raw_links_that_bypass_public_broker_rules() {
        for url in [
            "glyph://v1/request?d=YWJjZA#fragment",
            "glyph://v1/request?d=YWJjZA&extra=value",
            "glyph://pay?to=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&extra=value",
            "glyph://pay/path?to=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ] {
            assert!(validate(url).is_err(), "request parser accepted {url}");
            assert!(validate_pay(url).is_err(), "pay parser accepted {url}");
        }
    }

    #[test]
    fn pending_queues_drop_the_oldest_item_at_the_limit() {
        let state = DeepLinkState::default();
        for index in 0..=MAX_PENDING_LINKS {
            state.store(format!("request-{index}"));
            state.store_payment(format!("payment-{index}"));
        }

        assert_eq!(state.take().as_deref(), Some("request-1"));
        assert_eq!(state.take_payment().as_deref(), Some("payment-1"));
    }

    #[test]
    fn delivery_urls_require_https_same_origin_and_global_literals() {
        assert!(validate_delivery_url(
            "https://demo.app/callback",
            "callback URL",
            "https://demo.app",
            false,
        )
        .is_ok());
        assert!(validate_delivery_url(
            "https://relay.glyphq.org/v1/callback/3dd2842cbb7f42a79354df9ddf6542ae",
            "callback URL",
            "https://glyphq.org",
            true,
        )
        .is_ok());

        for url in [
            "http://demo.app/callback",
            "https://attacker.example/callback",
            "https://127.0.0.1/callback",
            "https://[::ffff:127.0.0.1]/callback",
            "https://relay.glyphq.org/v1/stream/3dd2842cbb7f42a79354df9ddf6542ae",
            "https://relay.glyphq.org/v1/callback/short",
            "https://relay.glyphq.org/v1/callback/3dd2842cbb7f42a79354df9ddf6542ae?extra=1",
        ] {
            assert!(validate_delivery_url(url, "callback URL", "https://demo.app", true).is_err());
        }

        assert!(validate_delivery_url(
            "https://relay.glyphq.org/v1/callback/3dd2842cbb7f42a79354df9ddf6542ae",
            "redirect_uri",
            "https://glyphq.org",
            false,
        )
        .is_err());
    }

    #[test]
    fn accepts_a_valid_request_with_an_official_relay_callback() {
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

        let envelope = serde_json::json!({
            "request": {
                "type": "connect",
                "dapp": { "name": "Glyph Support", "origin": "https://glyphq.org" },
                "permissions": ["transfer"],
                "nonce": "5b4bf4a7a53f4f29892892520dcaeffb",
                "exp": now_secs() + 300,
            },
            "callback": "https://relay.glyphq.org/v1/callback/3dd2842cbb7f42a79354df9ddf6542ae",
            "redirect_uri": null,
        });
        let url = format!(
            "glyph://v1/request?d={}",
            URL_SAFE_NO_PAD.encode(envelope.to_string())
        );

        assert!(validate(&url).is_ok());
    }

    #[test]
    fn dapp_origin_must_not_contain_non_origin_components() {
        assert_eq!(
            validate_dapp_origin("https://demo.app/"),
            Ok("https://demo.app".into())
        );

        for origin in [
            "http://demo.app/",
            "https://user@demo.app/",
            "https://demo.app/path",
            "https://demo.app/?query=value",
            "https://demo.app/#fragment",
        ] {
            assert!(validate_dapp_origin(origin).is_err(), "accepted {origin}");
        }
    }
}
