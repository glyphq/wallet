use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
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
pub const MAX_SIGNING_AUTHORIZATION_AGE_SECS: u64 = 300;
// The relay is the only trusted cross-origin callback transport. Its exact
// origin and callback route remain constrained below, including a bounded nonce.
const OFFICIAL_RELAY_ORIGIN: &str = "https://relay.glyphq.org";
const REQUEST_PROTOCOL_V2: &str = "glyph-connect-request/2";
const CALLBACK_ENVELOPE_VERSION_V2: &str = "glyph-connect-callback-envelope/2";

pub struct DeepLinkState {
    pending_requests: Arc<Mutex<VecDeque<String>>>,
    pending_payments: Arc<Mutex<VecDeque<String>>>,
    /// Recently completed, native-validated envelopes that may still deliver
    /// their callback. This preserves retry support without exposing a generic
    /// outbound HTTP primitive to the renderer.
    callback_delivery_payloads: Arc<Mutex<VecDeque<String>>>,
    /// Maps v2 replay key → unix timestamp of first receipt for time-bounded replay protection.
    seen_nonces: Arc<Mutex<HashMap<String, u64>>>,
    accepted_requests: Arc<Mutex<HashMap<String, u64>>>,
    signing_authorizations: Arc<Mutex<HashMap<String, SigningAuthorization>>>,
    authorization_counter: AtomicU64,
}

#[derive(Clone, Debug)]
struct SigningAuthorization {
    kind: AuthorizationKind,
    payload: Option<String>,
    dapp_origin: Option<String>,
    account_index: usize,
    intent: String,
    expires_at: u64,
    user_consumed: bool,
    callback_hash: Option<String>,
    expected_operation: Option<ExpectedOperation>,
    expected_callback_identity: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum AuthorizationKind {
    UserOperation,
    CallbackOnly,
    BoundCallback,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum ExpectedOperation {
    Transaction {
        tx_hash: String,
        target_tick: u32,
        identity: String,
    },
    Message {
        signature: Vec<u8>,
        public_key: Vec<u8>,
        identity: String,
    },
}

impl Default for DeepLinkState {
    fn default() -> Self {
        Self {
            pending_requests: Arc::new(Mutex::new(VecDeque::new())),
            pending_payments: Arc::new(Mutex::new(VecDeque::new())),
            callback_delivery_payloads: Arc::new(Mutex::new(VecDeque::new())),
            seen_nonces: Arc::new(Mutex::new(HashMap::new())),
            accepted_requests: Arc::new(Mutex::new(HashMap::new())),
            signing_authorizations: Arc::new(Mutex::new(HashMap::new())),
            authorization_counter: AtomicU64::new(0),
        }
    }
}

impl DeepLinkState {
    /// Queue an already validated request once. Never evict an older request:
    /// preserving its FIFO position is safer than replacing a request that is
    /// already awaiting explicit user review.
    pub fn store(&self, payload: String) -> bool {
        let mut queue = self
            .pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if queue.contains(&payload) || queue.len() >= MAX_PENDING_LINKS {
            return false;
        }
        queue.push_back(payload);
        true
    }

    pub fn peek(&self) -> Option<String> {
        self.pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .front()
            .cloned()
    }

    /// Remove only the expected queue head. A stale renderer event must never
    /// consume the request that arrived after it.
    pub fn take_if_front(&self, payload: &str) -> bool {
        let mut queue = self
            .pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if queue.front().is_some_and(|front| front == payload) {
            let completed_payload = queue.pop_front().expect("queue front was present");
            drop(queue);
            Self::store_bounded(&self.callback_delivery_payloads, completed_payload);
            true
        } else {
            false
        }
    }

    /// Only the active request or a recently completed request can submit its
    /// callback. The URL itself is always re-read from the native-validated
    /// envelope, so renderer input cannot select a new destination.
    pub fn authorizes_callback_delivery(&self, payload: &str) -> bool {
        if self
            .pending_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .front()
            .is_some_and(|front| front == payload)
        {
            return true;
        }
        self.callback_delivery_payloads
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .any(|completed| completed == payload)
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

    fn persist_seen_nonces(app: &AppHandle, seen: &HashMap<String, u64>) -> Result<(), String> {
        let store = app
            .store(NONCE_STORE_PATH)
            .map_err(|error| format!("could not open replay protection storage: {error}"))?;
        let value = serde_json::to_value(seen)
            .map_err(|error| format!("could not serialize replay protection storage: {error}"))?;
        store.set(NONCE_STORE_KEY, value);
        store
            .save()
            .map_err(|error| format!("could not persist replay protection storage: {error}"))
    }

    /// Returns false if the replay key was already seen within the last hour (replay), true if fresh.
    /// The map mutex is held through persistence so a stale snapshot cannot overwrite a newer nonce.
    pub fn record_nonce(&self, app: &AppHandle, nonce: &str) -> Result<bool, String> {
        let mut seen = self.seen_nonces.lock().unwrap_or_else(|e| e.into_inner());
        let now = now_secs();
        Self::prune_seen_nonces(&mut seen, now);
        if seen.contains_key(nonce) {
            return Ok(false);
        }
        seen.insert(nonce.to_string(), now);
        Self::persist_seen_nonces(app, &seen)?;
        Ok(true)
    }

    pub fn mark_request_accepted(&self, payload: &str) -> Result<(), String> {
        let [_, dapp_origin, _, request_hash] = replay_parts_from_envelope_payload(payload)?;
        let envelope: Value =
            serde_json::from_str(payload).map_err(|_| "invalid pending request".to_string())?;
        let now = now_secs();
        let expires_at = envelope
            .get("request")
            .and_then(|request| request.get("exp"))
            .and_then(Value::as_u64)
            .unwrap_or(now.saturating_add(MAX_SIGNING_AUTHORIZATION_AGE_SECS))
            .min(now.saturating_add(MAX_SIGNING_AUTHORIZATION_AGE_SECS));
        if expires_at <= now {
            return Err("request has expired".into());
        }
        let mut accepted = self
            .accepted_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        accepted.retain(|_, expires_at| *expires_at > now);
        accepted.insert(payload.to_string(), expires_at);
        if dapp_origin.is_empty() || request_hash.is_empty() {
            return Err("pending request identity is incomplete".into());
        }
        Ok(())
    }

    pub fn authorize_request(
        &self,
        payload: &str,
        dapp_origin: &str,
        request_hash: &str,
        account_index: usize,
        intent: String,
    ) -> Result<String, String> {
        let now = now_secs();
        let [_, expected_origin, _, expected_hash] = replay_parts_from_envelope_payload(payload)?;
        if expected_origin != dapp_origin || expected_hash != request_hash {
            return Err("signing authorization does not match the reviewed request".into());
        }
        let expires_at = self
            .accepted_requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(payload)
            .ok_or_else(|| "request is not pending native approval".to_string())?;
        if expires_at <= now {
            return Err("request approval has expired".into());
        }

        let kind = if intent.starts_with("callback:") {
            AuthorizationKind::CallbackOnly
        } else {
            AuthorizationKind::UserOperation
        };
        let token = self.new_authorization_token(payload, dapp_origin, account_index);
        let mut authorizations = self
            .signing_authorizations
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        authorizations.retain(|_, authorization| authorization.expires_at > now);
        authorizations.insert(
            token.clone(),
            SigningAuthorization {
                kind,
                payload: Some(payload.to_string()),
                dapp_origin: Some(dapp_origin.to_string()),
                account_index,
                intent,
                expires_at,
                user_consumed: false,
                callback_hash: None,
                expected_operation: None,
                expected_callback_identity: None,
            },
        );
        Ok(token)
    }

    fn new_authorization_token(&self, payload: &str, origin: &str, account_index: usize) -> String {
        let counter = self.authorization_counter.fetch_add(1, Ordering::Relaxed);
        format!(
            "auth_{}",
            sha256_base64url(&format!(
                "{payload}|{origin}|{account_index}|{}|{counter}",
                now_secs()
            ))
        )
    }

    pub fn consume_user_authorization(
        &self,
        token: &str,
        payload: Option<&str>,
        dapp_origin: Option<&str>,
        account_index: usize,
        intent: &str,
    ) -> Result<(), String> {
        self.consume_authorization(token, payload, dapp_origin, account_index, intent)
    }

    pub fn clear_signing_authorizations(&self) {
        self.signing_authorizations
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
    }

    fn consume_authorization(
        &self,
        token: &str,
        payload: Option<&str>,
        dapp_origin: Option<&str>,
        account_index: usize,
        intent: &str,
    ) -> Result<(), String> {
        let now = now_secs();
        let mut authorizations = self
            .signing_authorizations
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let authorization = authorizations
            .get_mut(token)
            .ok_or_else(|| "signing authorization is invalid or expired".to_string())?;
        if authorization.expires_at <= now {
            authorizations.remove(token);
            return Err("signing authorization has expired".into());
        }
        if authorization.account_index != account_index
            || authorization.payload.as_deref() != payload
            || authorization.dapp_origin.as_deref() != dapp_origin
            || authorization.kind != AuthorizationKind::UserOperation
            || authorization.intent != intent
        {
            return Err("signing authorization does not match the reviewed operation".into());
        }
        if authorization.user_consumed {
            return Err("signing authorization has already been consumed".into());
        }
        authorization.user_consumed = true;
        Ok(())
    }

    pub fn record_transaction_result(
        &self,
        token: &str,
        tx_hash: String,
        target_tick: u32,
        identity: String,
    ) -> Result<(), String> {
        let mut authorizations = self
            .signing_authorizations
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let authorization = authorizations
            .get_mut(token)
            .ok_or_else(|| "signing authorization is invalid or expired".to_string())?;
        if authorization.kind != AuthorizationKind::UserOperation || !authorization.user_consumed {
            return Err("transaction authorization is not ready for callback binding".into());
        }
        authorization.expected_operation = Some(ExpectedOperation::Transaction {
            tx_hash,
            target_tick,
            identity,
        });
        Ok(())
    }

    pub fn record_message_result(
        &self,
        token: &str,
        signature: Vec<u8>,
        public_key: Vec<u8>,
        identity: String,
    ) -> Result<(), String> {
        let mut authorizations = self
            .signing_authorizations
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let authorization = authorizations
            .get_mut(token)
            .ok_or_else(|| "signing authorization is invalid or expired".to_string())?;
        if authorization.kind != AuthorizationKind::UserOperation || !authorization.user_consumed {
            return Err("message authorization is not ready for callback binding".into());
        }
        authorization.expected_operation = Some(ExpectedOperation::Message {
            signature,
            public_key,
            identity,
        });
        Ok(())
    }

    pub fn authorize_callback_message(
        &self,
        token: &str,
        payload: &str,
        dapp_origin: &str,
        account_index: usize,
        message_bytes: &[u8],
        callback_result: &Value,
    ) -> Result<String, String> {
        let now = now_secs();
        let mut authorizations = self
            .signing_authorizations
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let authorization = authorizations
            .get(token)
            .cloned()
            .ok_or_else(|| "signing authorization is invalid or expired".to_string())?;
        if authorization.expires_at <= now {
            return Err("signing authorization has expired".into());
        }
        if authorization.payload.as_deref() != Some(payload)
            || authorization.dapp_origin.as_deref() != Some(dapp_origin)
            || authorization.account_index != account_index
        {
            return Err("callback authorization does not match the reviewed request".into());
        }
        if authorization.kind == AuthorizationKind::UserOperation
            && (!authorization.user_consumed || authorization.expected_operation.is_none())
        {
            return Err("transaction or message authorization has not completed".into());
        }
        if authorization.kind == AuthorizationKind::BoundCallback {
            return Err("callback authorization has already been consumed".into());
        }

        validate_callback_message(payload, message_bytes, callback_result, &authorization)?;

        let callback_hash = sha256_base64url_bytes(message_bytes);
        let callback_identity = if authorization.expected_operation.is_some()
            || (authorization.intent == "callback:response"
                && callback_result.get("type").and_then(Value::as_str) == Some("connect"))
        {
            callback_result
                .get("identity")
                .and_then(Value::as_str)
                .map(str::to_string)
        } else {
            None
        };
        let callback_token = self.new_authorization_token(payload, dapp_origin, account_index);
        authorizations.remove(token);
        authorizations.insert(
            callback_token.clone(),
            SigningAuthorization {
                kind: AuthorizationKind::BoundCallback,
                payload: authorization.payload,
                dapp_origin: authorization.dapp_origin,
                account_index,
                intent: authorization.intent,
                expires_at: authorization.expires_at,
                user_consumed: true,
                callback_hash: Some(callback_hash),
                expected_operation: authorization.expected_operation,
                expected_callback_identity: callback_identity,
            },
        );
        Ok(callback_token)
    }

    pub fn consume_callback_authorization(
        &self,
        token: &str,
        payload: Option<&str>,
        dapp_origin: Option<&str>,
        account_index: usize,
        message_bytes: &[u8],
    ) -> Result<Option<String>, String> {
        let now = now_secs();
        let mut authorizations = self
            .signing_authorizations
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let authorization = authorizations
            .remove(token)
            .ok_or_else(|| "callback authorization is invalid or expired".to_string())?;
        if authorization.expires_at <= now {
            return Err("callback authorization has expired".into());
        }
        if authorization.kind != AuthorizationKind::BoundCallback
            || authorization.payload.as_deref() != payload
            || authorization.dapp_origin.as_deref() != dapp_origin
            || authorization.account_index != account_index
            || authorization.callback_hash.as_deref()
                != Some(sha256_base64url_bytes(message_bytes).as_str())
        {
            return Err("callback bytes do not match the authorized callback".into());
        }
        Ok(authorization.expected_callback_identity)
    }
}

pub fn replay_key_from_envelope_payload(payload: &str) -> Result<String, String> {
    Ok(format!(
        "v2|{}",
        replay_parts_from_envelope_payload(payload)?.join("|")
    ))
}

pub fn callback_from_envelope_payload(payload: &str) -> Result<Option<String>, String> {
    let envelope: Value =
        serde_json::from_str(payload).map_err(|_| "invalid pending request".to_string())?;
    envelope
        .get("callback")
        .and_then(|value| {
            if value.is_null() {
                Some(None)
            } else {
                value.as_str().map(|callback| Some(callback.to_string()))
            }
        })
        .ok_or_else(|| "pending request has an invalid callback".to_string())
}

pub fn replay_parts_from_envelope_payload(payload: &str) -> Result<[String; 4], String> {
    let envelope: Value =
        serde_json::from_str(payload).map_err(|e| format!("invalid pending request: {e}"))?;
    let request = envelope
        .get("request")
        .and_then(Value::as_object)
        .ok_or("missing request")?;
    let nonce = request
        .get("nonce")
        .and_then(Value::as_str)
        .ok_or("missing nonce")?;
    let dapp_origin = request
        .get("dapp")
        .and_then(Value::as_object)
        .and_then(|dapp| dapp.get("origin"))
        .and_then(Value::as_str)
        .ok_or("missing dapp.origin")?;
    let network_id = envelope
        .get("network")
        .and_then(Value::as_object)
        .and_then(|network| network.get("id"))
        .and_then(Value::as_str)
        .ok_or("missing network.id")?;
    let request_hash = envelope
        .get("request_hash")
        .and_then(Value::as_str)
        .ok_or("missing request_hash")?;
    Ok([
        network_id.to_string(),
        dapp_origin.to_string(),
        nonce.to_string(),
        request_hash.to_string(),
    ])
}

struct ParsedRequest {
    request: Value,
    request_hash: String,
    network: Value,
    callback: Option<String>,
    redirect_uri: Option<String>,
}

fn jcs(value: &Value) -> Result<String, String> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
            serde_json::to_string(value).map_err(|e| e.to_string())
        }
        Value::Array(items) => Ok(format!(
            "[{}]",
            items
                .iter()
                .map(jcs)
                .collect::<Result<Vec<_>, _>>()?
                .join(",")
        )),
        Value::Object(map) => {
            let mut keys = map.keys().collect::<Vec<_>>();
            keys.sort();
            let mut parts = Vec::with_capacity(keys.len());
            for key in keys {
                let encoded_key = serde_json::to_string(key).map_err(|e| e.to_string())?;
                parts.push(format!("{}:{}", encoded_key, jcs(&map[key])?));
            }
            Ok(format!("{{{}}}", parts.join(",")))
        }
    }
}

fn sha256_base64url(input: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(input.as_bytes()))
}

fn sha256_base64url_bytes(input: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(input))
}

fn callback_field<'a>(payload: &'a Value, field: &str) -> Result<&'a str, String> {
    payload
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("callback payload is missing {field}"))
}

fn expected_callback_relay(callback: Option<&str>) -> Result<Value, String> {
    let null_binding = |callback_url: Option<&str>| {
        serde_json::json!({
            "callback_url": callback_url,
            "official_relay": false,
            "route": callback_url.map(|_| "unknown"),
            "v1_nonce": null,
            "session_id": null,
            "callback_capability_fingerprint": null,
        })
    };
    let Some(callback) = callback else {
        return Ok(null_binding(None));
    };
    let url = Url::parse(callback).map_err(|_| "request callback URL is invalid".to_string())?;
    if !is_official_relay_callback(&url) {
        return Ok(null_binding(Some(callback)));
    }
    let path = url
        .path()
        .strip_prefix("/v2/callback/")
        .ok_or_else(|| "official relay callback route is invalid".to_string())?;
    let mut segments = path.split('/');
    let session = segments
        .next()
        .ok_or_else(|| "official relay callback session is missing".to_string())?;
    let capability = segments
        .next()
        .ok_or_else(|| "official relay callback capability is missing".to_string())?;
    let fingerprint = sha256_base64url(capability);
    Ok(serde_json::json!({
        "callback_url": format!("{OFFICIAL_RELAY_ORIGIN}/v2/callback/{session}/{fingerprint}"),
        "official_relay": true,
        "route": "v2_session_callback",
        "v1_nonce": null,
        "session_id": session,
        "callback_capability_fingerprint": fingerprint,
    }))
}

fn validate_callback_message(
    request_payload: &str,
    message_bytes: &[u8],
    callback_result: &Value,
    authorization: &SigningAuthorization,
) -> Result<(), String> {
    let signed_payload = std::str::from_utf8(message_bytes)
        .map_err(|_| "callback payload is not UTF-8".to_string())?;
    let signed_value: Value = serde_json::from_str(signed_payload)
        .map_err(|_| "callback payload is not valid JSON".to_string())?;
    if jcs(&signed_value)? != signed_payload {
        return Err("callback payload must use canonical JSON".into());
    }
    if callback_field(&signed_value, "version")? != CALLBACK_ENVELOPE_VERSION_V2 {
        return Err("callback payload has an unsupported version".into());
    }

    let request: Value = serde_json::from_str(request_payload)
        .map_err(|_| "invalid signing request authorization payload".to_string())?;
    let [network, origin, nonce, request_hash] =
        replay_parts_from_envelope_payload(request_payload)?;
    if callback_field(&signed_value, "request_hash")? != request_hash
        || callback_field(&signed_value, "nonce")? != nonce
        || callback_field(&signed_value, "dapp_origin")? != origin
    {
        return Err("callback payload does not match the reviewed request".into());
    }
    if signed_value
        .get("network")
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        != Some(network.as_str())
    {
        return Err("callback network does not match the reviewed request".into());
    }
    let request_type = request
        .get("request")
        .and_then(|value| value.get("type"))
        .and_then(Value::as_str)
        .ok_or("reviewed request has no type")?;
    if callback_field(&signed_value, "request_type")? != request_type {
        return Err("callback request type does not match the reviewed request".into());
    }
    let request_exp = request
        .get("request")
        .and_then(|value| value.get("exp"))
        .cloned()
        .unwrap_or(Value::Null);
    if signed_value.get("exp").cloned().unwrap_or(Value::Null) != request_exp {
        return Err("callback expiry does not match the reviewed request".into());
    }
    let expected_relay =
        expected_callback_relay(callback_from_envelope_payload(request_payload)?.as_deref())?;
    if signed_value.get("relay") != Some(&expected_relay) {
        return Err("callback destination does not match the reviewed request".into());
    }
    if signed_value.get("result_hash").and_then(Value::as_str)
        != Some(format!("sha256:{}", sha256_base64url(&jcs(callback_result)?)).as_str())
    {
        return Err("callback result is not bound to the signed payload".into());
    }
    if callback_result.get("nonce").and_then(Value::as_str) != Some(nonce.as_str())
        || callback_result.get("type").and_then(Value::as_str) != Some(request_type)
    {
        return Err("callback result does not match the reviewed request".into());
    }

    match (
        &authorization.kind,
        authorization.intent.as_str(),
        &authorization.expected_operation,
    ) {
        (AuthorizationKind::CallbackOnly, "callback:rejected", None) => {
            if callback_result.get("status").and_then(Value::as_str) != Some("rejected")
                || callback_result.get("reason").and_then(Value::as_str) != Some("user_rejected")
            {
                return Err("callback is not an authorized rejection response".into());
            }
        }
        (AuthorizationKind::CallbackOnly, "callback:response", None) => {
            let expected_status = match request_type {
                "connect" => "connected",
                "verify_message" => "verified",
                _ => return Err("callback-only authorization is not valid for this request".into()),
            };
            if callback_result.get("status").and_then(Value::as_str) != Some(expected_status) {
                return Err("callback status does not match the reviewed request".into());
            }
        }
        (
            AuthorizationKind::UserOperation,
            _,
            Some(ExpectedOperation::Transaction {
                tx_hash,
                target_tick,
                identity,
            }),
        ) => {
            if callback_result.get("status").and_then(Value::as_str) != Some("signed")
                || callback_result.get("tx_hash").and_then(Value::as_str) != Some(tx_hash)
                || callback_result.get("target_tick").and_then(Value::as_u64)
                    != Some(*target_tick as u64)
                || callback_result.get("identity").and_then(Value::as_str) != Some(identity)
            {
                return Err("signed transaction callback is not bound to the native result".into());
            }
        }
        (
            AuthorizationKind::UserOperation,
            _,
            Some(ExpectedOperation::Message {
                signature,
                public_key,
                identity,
            }),
        ) => {
            let expected_signature = base64::engine::general_purpose::STANDARD.encode(signature);
            let expected_public_key = base64::engine::general_purpose::STANDARD.encode(public_key);
            if callback_result.get("status").and_then(Value::as_str) != Some("signed")
                || callback_result.get("signature").and_then(Value::as_str)
                    != Some(expected_signature.as_str())
                || callback_result.get("public_key").and_then(Value::as_str)
                    != Some(expected_public_key.as_str())
                || callback_result.get("identity").and_then(Value::as_str) != Some(identity)
            {
                return Err("signed message callback is not bound to the native result".into());
            }
        }
        _ => return Err("callback authorization is not ready for this response".into()),
    }
    Ok(())
}

fn validate_network(value: &Value) -> Result<(), String> {
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .ok_or("missing network.id")?;
    if id == "qubic:mainnet" || id == "qubic:testnet" {
        return Ok(());
    }
    let suffix = id
        .strip_prefix("qubic:custom:sha256:")
        .ok_or("invalid network.id")?;
    if suffix.len() == 43
        && suffix
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
    {
        Ok(())
    } else {
        Err("invalid custom network hash".into())
    }
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

    let Some(path) = url.path().strip_prefix("/v2/callback/") else {
        return false;
    };
    let mut segments = path.split('/');
    let (Some(session), Some(callback_cap), None) =
        (segments.next(), segments.next(), segments.next())
    else {
        return false;
    };
    let is_base64url = |value: &str| {
        value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    };
    session.len() >= 22
        && session.len() <= 128
        && is_base64url(session)
        && callback_cap.starts_with("c_")
        && callback_cap.len() >= 24
        && callback_cap.len() <= 128
        && is_base64url(&callback_cap[2..])
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
        return Err(format!(
            "{field} must use HTTPS without embedded credentials"
        ));
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

    if crate::link_broker::validate_launch_url(uri_str) != Ok(crate::link_broker::LinkKind::Request)
    {
        return Err("expected glyph://v2/request".into());
    }

    let mut d_param: Option<String> = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "d" if d_param.is_none() => d_param = Some(v.into_owned()),
            "d" => return Err("duplicate query parameters are not allowed".into()),
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

    if value.get("protocol").and_then(Value::as_str) != Some(REQUEST_PROTOCOL_V2) {
        return Err("invalid request protocol".into());
    }
    let request_value = value
        .get("request")
        .filter(|v| v.is_object())
        .ok_or("missing request envelope")?
        .clone();
    let callback_from_payload = value
        .get("callback")
        .and_then(|v| {
            if v.is_null() {
                Some(None)
            } else {
                v.as_str().map(|s| Some(s.to_string()))
            }
        })
        .ok_or("callback must be present as string or null")?;
    let redirect_uri_from_payload = value
        .get("redirect_uri")
        .and_then(|v| {
            if v.is_null() {
                Some(None)
            } else {
                v.as_str().map(|s| Some(s.to_string()))
            }
        })
        .ok_or("redirect_uri must be present as string or null")?;
    let network = value
        .get("network")
        .filter(|v| v.is_object())
        .ok_or("missing network envelope")?
        .clone();
    validate_network(&network)?;
    let request_hash = value
        .get("request_hash")
        .and_then(Value::as_str)
        .ok_or("missing request_hash")?;
    let hash_material = serde_json::json!({
        "protocol": REQUEST_PROTOCOL_V2,
        "request": request_value,
        "callback": callback_from_payload,
        "redirect_uri": redirect_uri_from_payload,
        "network": network,
    });
    let expected_hash = format!("sha256:{}", sha256_base64url(&jcs(&hash_material)?));
    if request_hash != expected_hash {
        return Err("request_hash mismatch".into());
    }
    let request_value = hash_material.get("request").unwrap().clone();
    let network = hash_material.get("network").unwrap().clone();

    // Required fields
    let req_type = request_value["type"]
        .as_str()
        .ok_or("missing 'type' field")?;

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

    let nonce = request_value["nonce"]
        .as_str()
        .ok_or("missing 'nonce' field")?;
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
    let callback = callback_from_payload;

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
            let to = request_value["to"]
                .as_str()
                .ok_or("transfer: missing 'to'")?;
            if crate::qubic_native::identity_to_public_key(to).is_err() {
                let preview: String = to.chars().take(8).collect();
                return Err(format!(
                    "transfer: 'to' must be a valid Qubic identity, got '{preview}'"
                ));
            }
            let amount =
                parse_positive_i64(&request_value["amount"]).ok_or("transfer: missing 'amount'")?;
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
                let amount =
                    parse_positive_i64(amount).ok_or("sc_call: 'amount' must be an integer")?;
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
        request: request_value,
        request_hash: expected_hash,
        network,
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
        return Err(format!(
            "invalid identity in 'to': {}",
            &to[..to.len().min(8)]
        ));
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
            let envelope = serde_json::json!({
                "protocol": REQUEST_PROTOCOL_V2,
                "request": parsed.request,
                "callback": parsed.callback,
                "redirect_uri": parsed.redirect_uri,
                "network": parsed.network,
                "request_hash": parsed.request_hash,
            });
            let payload = envelope.to_string();
            if state.store(payload.clone()) {
                app.emit("glyph:request", payload).ok();
                true
            } else {
                false
            }
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
            process_url(app, url.as_ref());
        }
    }

    let handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            process_url(&handle, url.as_ref());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        callback_from_envelope_payload, jcs, now_secs, replay_key_from_envelope_payload,
        sha256_base64url, validate, validate_dapp_origin, validate_delivery_url, validate_pay,
        DeepLinkState, CALLBACK_ENVELOPE_VERSION_V2, MAX_PENDING_LINKS, REQUEST_PROTOCOL_V2,
    };
    use serde_json::Value;

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
    fn pending_request_queue_preserves_oldest_item_at_the_limit() {
        let state = DeepLinkState::default();
        for index in 0..=MAX_PENDING_LINKS {
            state.store(format!("request-{index}"));
            state.store_payment(format!("payment-{index}"));
        }

        assert!(state.take_if_front("request-0"));
        assert_eq!(state.take_payment().as_deref(), Some("payment-1"));
    }

    #[test]
    fn pending_request_queue_deduplicates_and_only_clears_its_head() {
        let state = DeepLinkState::default();
        assert!(state.store("first".to_string()));
        assert!(!state.store("first".to_string()));
        assert!(state.store("second".to_string()));

        assert!(!state.take_if_front("second"));
        assert_eq!(state.peek().as_deref(), Some("first"));
        assert!(state.take_if_front("first"));
        assert_eq!(state.peek().as_deref(), Some("second"));
    }

    #[test]
    fn callback_delivery_is_limited_to_native_queue_payloads() {
        let state = DeepLinkState::default();
        let first = r#"{"callback":"https://demo.app/callback"}"#;
        let second = r#"{"callback":"https://demo.app/second"}"#;
        assert!(state.store(first.to_string()));
        assert!(state.store(second.to_string()));
        assert!(state.authorizes_callback_delivery(first));
        assert!(!state.authorizes_callback_delivery(second));
        assert!(state.take_if_front(first));
        assert!(state.authorizes_callback_delivery(first));
        assert!(state.authorizes_callback_delivery(second));
        assert!(!state.authorizes_callback_delivery("not-a-queued-request"));
        assert_eq!(
            callback_from_envelope_payload(first).unwrap().as_deref(),
            Some("https://demo.app/callback")
        );
    }

    #[test]
    fn replay_key_is_derived_at_the_acceptance_boundary() {
        let payload = serde_json::json!({
            "protocol": REQUEST_PROTOCOL_V2,
            "request": {
                "type": "connect",
                "dapp": { "name": "Demo", "origin": "https://demo.app" },
                "nonce": "network-switch-nonce",
                "exp": now_secs() + 300,
            },
            "callback": null,
            "redirect_uri": null,
            "network": { "id": "qubic:testnet" },
            "request_hash": "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
        })
        .to_string();

        assert_eq!(
            replay_key_from_envelope_payload(&payload).unwrap(),
            "v2|qubic:testnet|https://demo.app|network-switch-nonce|sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_"
        );
    }

    fn authorization_payload(exp: u64) -> String {
        serde_json::json!({
            "request": {
                "dapp": { "origin": "https://demo.app" },
                "nonce": "authorization-test-nonce",
                "exp": exp,
            },
            "network": { "id": "qubic:mainnet" },
            "request_hash": "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
        })
        .to_string()
    }

    #[test]
    fn signing_authorization_is_bound_and_each_capability_is_consumed_once() {
        let state = DeepLinkState::default();
        let payload = authorization_payload(now_secs() + 60);
        state.mark_request_accepted(&payload).unwrap();

        let token = state
            .authorize_request(
                &payload,
                "https://demo.app",
                "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
                2,
                "message-intent".into(),
            )
            .unwrap();
        assert!(state
            .authorize_request(
                &payload,
                "https://demo.app",
                "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
                2,
                "message-intent".into(),
            )
            .is_err());
        assert!(state
            .consume_user_authorization(
                &token,
                Some(&payload),
                Some("https://demo.app"),
                2,
                "message-intent",
            )
            .is_ok());
        assert!(state
            .consume_user_authorization(
                &token,
                Some(&payload),
                Some("https://demo.app"),
                2,
                "message-intent",
            )
            .is_err());
        assert!(state
            .consume_callback_authorization(
                &token,
                Some(&payload),
                Some("https://demo.app"),
                2,
                b"callback",
            )
            .is_err());
        assert!(state
            .consume_callback_authorization(
                &token,
                Some(&payload),
                Some("https://demo.app"),
                2,
                b"callback",
            )
            .is_err());
    }

    #[test]
    fn signing_authorization_rejects_wrong_origin_account_intent_and_expiry() {
        let state = DeepLinkState::default();
        let payload = authorization_payload(now_secs() + 60);
        state.mark_request_accepted(&payload).unwrap();
        assert!(state
            .authorize_request(
                &payload,
                "https://evil.example",
                "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
                0,
                "intent".into(),
            )
            .is_err());
        let token = state
            .authorize_request(
                &payload,
                "https://demo.app",
                "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
                0,
                "intent".into(),
            )
            .unwrap();
        assert!(state
            .consume_user_authorization(
                &token,
                Some(&payload),
                Some("https://demo.app"),
                1,
                "intent",
            )
            .is_err());

        let expired = authorization_payload(now_secs().saturating_sub(1));
        assert!(state.mark_request_accepted(&expired).is_err());
    }

    fn callback_authorization_fixture() -> (String, Value, Vec<u8>) {
        let exp = now_secs() + 60;
        let payload = serde_json::json!({
            "request": {
                "type": "connect",
                "dapp": { "origin": "https://demo.app" },
                "nonce": "callback-test-nonce",
                "exp": exp,
            },
            "callback": "https://demo.app/callback",
            "network": { "id": "qubic:mainnet" },
            "request_hash": "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
        })
        .to_string();
        let result = serde_json::json!({
            "status": "connected",
            "type": "connect",
            "nonce": "callback-test-nonce",
            "identity": "ID1",
            "permissions": [],
        });
        let callback_payload = serde_json::json!({
            "version": CALLBACK_ENVELOPE_VERSION_V2,
            "request_hash": "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
            "network": { "id": "qubic:mainnet" },
            "nonce": "callback-test-nonce",
            "dapp_origin": "https://demo.app",
            "request_type": "connect",
            "exp": exp,
            "issued_at": exp - 1,
            "result_hash": format!("sha256:{}", sha256_base64url(&jcs(&result).unwrap())),
            "relay": {
                "callback_url": "https://demo.app/callback",
                "official_relay": false,
                "route": "unknown",
                "v1_nonce": null,
                "session_id": null,
                "callback_capability_fingerprint": null,
            },
        });
        let bytes = jcs(&callback_payload).unwrap().into_bytes();
        (payload, result, bytes)
    }

    #[test]
    fn callback_capability_is_separate_one_time_and_binds_exact_bytes_and_result() {
        let state = DeepLinkState::default();
        let (payload, result, bytes) = callback_authorization_fixture();
        state.mark_request_accepted(&payload).unwrap();
        let token = state
            .authorize_request(
                &payload,
                "https://demo.app",
                "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
                0,
                "callback:response".into(),
            )
            .unwrap();

        let callback_token = state
            .authorize_callback_message(&token, &payload, "https://demo.app", 0, &bytes, &result)
            .unwrap();
        assert_ne!(callback_token, token);
        assert!(state
            .consume_callback_authorization(
                &callback_token,
                Some(&payload),
                Some("https://demo.app"),
                0,
                &bytes,
            )
            .unwrap()
            .is_some());
        assert!(state
            .consume_callback_authorization(
                &callback_token,
                Some(&payload),
                Some("https://demo.app"),
                0,
                &bytes,
            )
            .is_err());
    }

    #[test]
    fn callback_binding_rejects_mutated_bytes_or_result_without_consuming_approval() {
        let state = DeepLinkState::default();
        let (payload, result, bytes) = callback_authorization_fixture();
        state.mark_request_accepted(&payload).unwrap();
        let token = state
            .authorize_request(
                &payload,
                "https://demo.app",
                "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
                0,
                "callback:response".into(),
            )
            .unwrap();

        let mut altered_bytes = bytes.clone();
        let altered_index = altered_bytes.len() - 2;
        altered_bytes[altered_index] ^= 1;
        assert!(state
            .authorize_callback_message(
                &token,
                &payload,
                "https://demo.app",
                0,
                &altered_bytes,
                &result,
            )
            .is_err());
        let mut altered_destination: Value = serde_json::from_slice(&bytes).unwrap();
        altered_destination["relay"]["callback_url"] =
            Value::String("https://evil.example/callback".into());
        let altered_destination_bytes = jcs(&altered_destination).unwrap().into_bytes();
        assert!(state
            .authorize_callback_message(
                &token,
                &payload,
                "https://demo.app",
                0,
                &altered_destination_bytes,
                &result,
            )
            .is_err());
        let altered_result = serde_json::json!({
            "status": "connected",
            "type": "connect",
            "nonce": "callback-test-nonce",
            "identity": "EVIL",
            "permissions": [],
        });
        assert!(state
            .authorize_callback_message(
                &token,
                &payload,
                "https://demo.app",
                0,
                &bytes,
                &altered_result,
            )
            .is_err());
        assert!(state
            .authorize_callback_message(&token, &payload, "https://demo.app", 0, &bytes, &result,)
            .is_ok());
    }

    #[test]
    fn user_operation_authorization_cannot_be_used_as_callback_only_capability() {
        let state = DeepLinkState::default();
        let payload = authorization_payload(now_secs() + 60);
        state.mark_request_accepted(&payload).unwrap();
        let token = state
            .authorize_request(
                &payload,
                "https://demo.app",
                "sha256:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_",
                0,
                "transaction-intent".into(),
            )
            .unwrap();
        assert!(state
            .authorize_callback_message(
                &token,
                &payload,
                "https://demo.app",
                0,
                b"{}",
                &serde_json::json!({}),
            )
            .is_err());
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
            "https://relay.glyphq.org/v2/callback/3dd2842cbb7f42a79354df9ddf6542/c_3dd2842cbb7f42a79354df9ddf6542",
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
            "https://relay.glyphq.org/v2/stream/3dd2842cbb7f42a79354df9ddf6542/r_3dd2842cbb7f42a79354df9ddf6542",
            "https://relay.glyphq.org/v1/callback/3dd2842cbb7f42a79354df9ddf6542ae",
            "https://relay.glyphq.org/v2/callback/short/c_3dd2842cbb7f42a79354df9ddf6542",
            "https://relay.glyphq.org/v2/callback/3dd2842cbb7f42a79354df9ddf6542/r_3dd2842cbb7f42a79354df9ddf6542",
            "https://relay.glyphq.org/v2/callback/3dd2842cbb7f42a79354df9ddf6542/c_3dd2842cbb7f42a79354df9ddf6542?extra=1",
        ] {
            assert!(validate_delivery_url(url, "callback URL", "https://demo.app", true).is_err());
        }

        assert!(validate_delivery_url(
            "https://relay.glyphq.org/v2/callback/3dd2842cbb7f42a79354df9ddf6542/c_3dd2842cbb7f42a79354df9ddf6542",
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
            "protocol": REQUEST_PROTOCOL_V2,
            "request": {
                "type": "connect",
                "dapp": { "name": "Glyph Support", "origin": "https://glyphq.org" },
                "permissions": ["transfer"],
                "nonce": "5b4bf4a7a53f4f29892892520dcaeffb",
                "exp": now_secs() + 300,
            },
            "callback": "https://relay.glyphq.org/v2/callback/3dd2842cbb7f42a79354df9ddf6542/c_3dd2842cbb7f42a79354df9ddf6542",
            "redirect_uri": null,
            "network": { "id": "qubic:mainnet" },
        });
        let mut envelope = envelope;
        let hash_material = serde_json::json!({
            "protocol": envelope["protocol"].clone(),
            "request": envelope["request"].clone(),
            "callback": envelope["callback"].clone(),
            "redirect_uri": envelope["redirect_uri"].clone(),
            "network": envelope["network"].clone(),
        });
        envelope["request_hash"] = serde_json::Value::String(format!(
            "sha256:{}",
            sha256_base64url(&jcs(&hash_material).unwrap())
        ));
        let url = format!(
            "glyph://v2/request?d={}",
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
