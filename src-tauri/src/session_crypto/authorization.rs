//! Signing request shapes and the review-binding checks for dApp intents.
//!
//! Every dApp signing request carries the JSON payload the user reviewed.  The
//! helpers here assert the concrete transaction or message matches that
//! payload before any seed is touched.

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignTransactionRequest {
    pub(super) account_index: usize,
    pub(super) destination: String,
    pub(super) amount: String,
    pub(super) target_tick: u32,
    pub(super) current_tick: Option<u32>,
    pub(super) input_type: u16,
    pub(super) payload: Vec<u8>,
    pub(super) authorization: String,
    pub(super) request_payload: Option<String>,
    pub(super) dapp_origin: Option<String>,
    pub(super) intent: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSignTransactionRequest {
    pub(super) account_index: usize,
    pub(super) destination: String,
    pub(super) amount: String,
    pub(super) target_tick: u32,
    pub(super) current_tick: Option<u32>,
    pub(super) input_type: u16,
    pub(super) payload: Vec<u8>,
}

#[derive(Serialize)]
pub struct SignedTxResult {
    pub(super) encoded: String,
    pub(super) hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignMessageRequest {
    pub(super) account_index: usize,
    pub(super) message_bytes: Vec<u8>,
    pub(super) authorization: String,
    pub(super) request_payload: Option<String>,
    pub(super) dapp_origin: Option<String>,
    pub(super) intent: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSignMessageRequest {
    pub(super) account_index: usize,
    pub(super) message_bytes: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignMessageResult {
    pub(super) signature: Vec<u8>,
    pub(super) public_key: Vec<u8>,
    pub(super) identity: String,
}

fn request_value(payload: &str) -> Result<Value, String> {
    let envelope: Value = serde_json::from_str(payload)
        .map_err(|_| "invalid signing request authorization payload".to_string())?;
    envelope
        .get("request")
        .cloned()
        .ok_or_else(|| "signing authorization payload has no request".to_string())
}

pub(super) fn ensure_transaction_matches_request(
    payload: &str,
    request: &SignTransactionRequest,
    amount: i64,
) -> Result<(), String> {
    let value = request_value(payload)?;
    let request_type = value
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| "signing authorization payload has no request type".to_string())?;
    let requested_amount = value
        .get("amount")
        .and_then(|value| value.as_i64().or_else(|| value.as_str()?.parse().ok()));
    if requested_amount != Some(amount) {
        return Err("transaction does not match the reviewed request".into());
    }
    match request_type {
        "transfer" => {
            if value.get("to").and_then(Value::as_str) != Some(request.destination.as_str()) {
                return Err("destination does not match the reviewed request".into());
            }
            if request.input_type != 0 || !request.payload.is_empty() {
                return Err("transfer fields do not match the reviewed request".into());
            }
        }
        "sc_call" => {
            let contract_index = value
                .get("contract_index")
                .and_then(Value::as_u64)
                .ok_or_else(|| "reviewed contract call has no contract index".to_string())?;
            let expected_destination =
                crate::qubic_native::contract_index_to_identity(contract_index as u32)?;
            if request.destination != expected_destination {
                return Err("contract destination does not match the reviewed contract".into());
            }
            if value.get("input_type").and_then(Value::as_u64) != Some(request.input_type as u64) {
                return Err("contract input type does not match the reviewed request".into());
            }
            if let Some(encoded) = value.get("payload").and_then(Value::as_str) {
                let decoded = base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .map_err(|_| "reviewed contract payload is invalid".to_string())?;
                if decoded != request.payload {
                    return Err("contract payload does not match the reviewed request".into());
                }
            } else if !request.payload.is_empty() {
                return Err("contract payload does not match the reviewed request".into());
            }
        }
        _ => return Err("authorization is not for a transaction request".into()),
    }
    Ok(())
}

pub(super) fn ensure_message_matches_request(
    payload: &str,
    request: &SignMessageRequest,
) -> Result<(), String> {
    let value = request_value(payload)?;
    if value.get("type").and_then(Value::as_str) != Some("sign_message") {
        return Err("authorization is not for a message-signing request".into());
    }
    let expected = if let Some(data) = value.get("data").and_then(Value::as_str) {
        base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|_| "reviewed message payload is invalid".to_string())?
    } else {
        value
            .get("message")
            .and_then(Value::as_str)
            .ok_or_else(|| "reviewed message has no content".to_string())?
            .as_bytes()
            .to_vec()
    };
    if expected != request.message_bytes {
        return Err("message does not match the reviewed request".into());
    }
    Ok(())
}
