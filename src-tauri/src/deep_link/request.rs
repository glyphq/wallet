//! Parsing and validation for `glyph://v2/request` envelopes.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde_json::Value;
use url::Url;

use super::envelope::{jcs, now_secs, parse_positive_i64, sha256_base64url, validate_network};
use super::url::{validate_dapp_origin, validate_delivery_url};
use super::{MAX_NONCE_AGE_SECS, MAX_SIGN_MESSAGE_LEN, REQUEST_PROTOCOL_V2};

pub(super) struct ParsedRequest {
    pub(super) request: Value,
    pub(super) request_hash: String,
    pub(super) network: Value,
    pub(super) callback: Option<String>,
    pub(super) redirect_uri: Option<String>,
}

pub(super) fn validate(uri_str: &str) -> Result<ParsedRequest, String> {
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
            if input_type > i64::from(u16::MAX) {
                return Err(format!("sc_call: 'input_type' out of range: {input_type}"));
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
