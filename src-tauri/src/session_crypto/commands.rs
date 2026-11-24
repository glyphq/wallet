//! Tauri commands that sign with the unlocked native session seeds.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{command, State};

use super::authorization::{
    ensure_message_matches_request, ensure_transaction_matches_request, LocalSignMessageRequest,
    LocalSignTransactionRequest, SignMessageRequest, SignMessageResult, SignTransactionRequest,
    SignedTxResult,
};
use super::state::{validate_session_seeds, NativeSessionState};
use crate::qubic_native;

const MAX_SIGN_MESSAGE_BYTES: usize = 64 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionAccountInfo {
    identity: String,
    public_key: Vec<u8>,
}

#[command]
pub fn get_session_accounts(state: State<'_, NativeSessionState>) -> Result<Vec<SessionAccountInfo>, String> {
    Ok(state
        .public_accounts()?
        .into_iter()
        .map(|(identity, public_key)| SessionAccountInfo { identity, public_key: public_key.to_vec() })
        .collect())
}


#[command]
pub async fn store_session_seeds(
    state: State<'_, NativeSessionState>,
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
    seeds: Vec<String>,
) -> Result<(), String> {
    validate_session_seeds(&seeds)?;
    authorization_state.clear_signing_authorizations();
    state.replace_seeds(seeds);
    Ok(())
}

#[command]
pub async fn clear_session_seeds(
    state: State<'_, NativeSessionState>,
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
) -> Result<(), String> {
    state.clear();
    authorization_state.clear_signing_authorizations();
    Ok(())
}

#[command]
pub async fn sign_transaction(
    state: State<'_, NativeSessionState>,
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
    request: SignTransactionRequest,
) -> Result<SignedTxResult, String> {
    let amount = request
        .amount
        .parse::<i64>()
        .map_err(|_| "amount must fit signed 64-bit integer".to_string())?;
    if amount < 0 {
        return Err("amount must not be negative".to_string());
    }
    let request_payload = request
        .request_payload
        .as_deref()
        .ok_or_else(|| "dApp transaction authorization payload is required".to_string())?;
    ensure_transaction_matches_request(request_payload, &request, amount)?;
    if request.dapp_origin.is_none() {
        return Err("dApp transaction authorization origin is required".into());
    }
    authorization_state.consume_user_authorization(
        &request.authorization,
        Some(request_payload),
        request.dapp_origin.as_deref(),
        request.account_index,
        &request.intent,
    )?;
    state
        .with_seed_at(request.account_index, |seed| {
            let (encoded, hash) = qubic_native::sign_transaction(
                seed,
                &request.destination,
                amount,
                request.target_tick,
                request.current_tick,
                request.input_type,
                &request.payload,
            )?;
            let identity = qubic_native::derive_identity_from_seed(seed)?;
            Ok((SignedTxResult { encoded, hash }, identity))
        })
        .await
        .and_then(|(result, identity)| {
            authorization_state.record_transaction_result(
                &request.authorization,
                result.hash.clone(),
                request.target_tick,
                identity,
            )?;
            Ok(result)
        })
}

#[command]
pub async fn sign_local_transaction(
    state: State<'_, NativeSessionState>,
    request: LocalSignTransactionRequest,
) -> Result<SignedTxResult, String> {
    let amount = request
        .amount
        .parse::<i64>()
        .map_err(|_| "amount must fit signed 64-bit integer".to_string())?;
    if amount < 0 {
        return Err("amount must not be negative".to_string());
    }
    state
        .with_seed_at(request.account_index, |seed| {
            let (encoded, hash) = qubic_native::sign_transaction(
                seed,
                &request.destination,
                amount,
                request.target_tick,
                request.current_tick,
                request.input_type,
                &request.payload,
            )?;
            Ok(SignedTxResult { encoded, hash })
        })
        .await
}

#[command]
pub async fn sign_message(
    state: State<'_, NativeSessionState>,
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
    request: SignMessageRequest,
) -> Result<SignMessageResult, String> {
    if request.message_bytes.len() > MAX_SIGN_MESSAGE_BYTES {
        return Err("message exceeds the native signing limit".to_string());
    }
    let request_payload = request
        .request_payload
        .as_deref()
        .ok_or_else(|| "dApp message authorization payload is required".to_string())?;
    ensure_message_matches_request(request_payload, &request)?;
    if request.dapp_origin.is_none() {
        return Err("dApp message authorization origin is required".into());
    }
    authorization_state.consume_user_authorization(
        &request.authorization,
        Some(request_payload),
        request.dapp_origin.as_deref(),
        request.account_index,
        &request.intent,
    )?;
    state
        .with_seed_at(request.account_index, |seed| {
            let (signature, public_key, identity) =
                qubic_native::sign_message(seed, &request.message_bytes)?;
            Ok(SignMessageResult {
                signature,
                public_key,
                identity,
            })
        })
        .await
        .and_then(|result| {
            authorization_state.record_message_result(
                &request.authorization,
                result.signature.clone(),
                result.public_key.clone(),
                result.identity.clone(),
            )?;
            Ok(result)
        })
}

#[command]
pub async fn sign_local_message(
    state: State<'_, NativeSessionState>,
    request: LocalSignMessageRequest,
) -> Result<SignMessageResult, String> {
    if request.message_bytes.len() > MAX_SIGN_MESSAGE_BYTES {
        return Err("message exceeds the native signing limit".to_string());
    }
    state
        .with_seed_at(request.account_index, |seed| {
            let (signature, public_key, identity) =
                qubic_native::sign_message(seed, &request.message_bytes)?;
            Ok(SignMessageResult {
                signature,
                public_key,
                identity,
            })
        })
        .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallbackAuthorizationRequest {
    authorization: String,
    request_payload: String,
    dapp_origin: String,
    account_index: usize,
    message_bytes: Vec<u8>,
    callback_result: Value,
}

#[command]
pub fn authorize_callback_message(
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
    request: CallbackAuthorizationRequest,
) -> Result<String, String> {
    authorization_state.authorize_callback_message(
        &request.authorization,
        &request.request_payload,
        &request.dapp_origin,
        request.account_index,
        &request.message_bytes,
        &request.callback_result,
    )
}

#[command]
pub async fn sign_callback_message(
    state: State<'_, NativeSessionState>,
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
    request: SignMessageRequest,
) -> Result<SignMessageResult, String> {
    if request.message_bytes.len() > MAX_SIGN_MESSAGE_BYTES {
        return Err("callback payload exceeds the native signing limit".to_string());
    }
    let expected_callback_identity = authorization_state.consume_callback_authorization(
        &request.authorization,
        request.request_payload.as_deref(),
        request.dapp_origin.as_deref(),
        request.account_index,
        &request.message_bytes,
    )?;
    state
        .with_seed_at_waiting_for_quota(request.account_index, |seed| {
            let (signature, public_key, identity) =
                qubic_native::sign_message(seed, &request.message_bytes)?;
            if let Some(expected_identity) = expected_callback_identity {
                if expected_identity != identity {
                    return Err("callback signer does not match the reviewed account".into());
                }
            }
            Ok(SignMessageResult {
                signature,
                public_key,
                identity,
            })
        })
        .await
}
