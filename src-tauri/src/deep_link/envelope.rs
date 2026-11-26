//! Envelope extraction, canonical (JCS) encoding, and hashing helpers shared by
//! request parsing, replay protection, and callback binding.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub(super) fn jcs(value: &Value) -> Result<String, String> {
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

pub(super) fn sha256_base64url(input: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(input.as_bytes()))
}

pub(super) fn sha256_base64url_bytes(input: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(input))
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

pub(super) fn validate_network(value: &Value) -> Result<(), String> {
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

pub(super) fn parse_positive_i64(value: &Value) -> Option<i64> {
    if let Some(number) = value.as_i64() {
        return Some(number);
    }
    value.as_str()?.parse::<i64>().ok()
}
