//! Callback delivery binding: signed callback payloads are matched against the
//! reviewed request and the relay/capability route it declared.

use base64::Engine;
use serde_json::Value;
use url::Url;

use super::authorization::{AuthorizationKind, ExpectedOperation, SigningAuthorization};
use super::envelope::{
    callback_from_envelope_payload, jcs, replay_parts_from_envelope_payload, sha256_base64url,
};
use super::url::is_official_relay_callback;
use super::{CALLBACK_ENVELOPE_VERSION_V2, OFFICIAL_RELAY_ORIGIN};

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

pub(super) fn validate_callback_message(
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
