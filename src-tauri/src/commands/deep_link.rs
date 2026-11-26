//! Pending deep-link request commands.

use tauri::{AppHandle, State};

use crate::deep_link::DeepLinkState;

#[tauri::command]
pub fn get_pending_request(state: State<'_, DeepLinkState>) -> Option<String> {
    state.peek()
}

#[tauri::command]
pub fn clear_pending_request(state: State<'_, DeepLinkState>, payload: String) -> bool {
    state.take_if_front(&payload)
}

#[tauri::command]
pub fn accept_pending_request(
    app: AppHandle,
    state: State<'_, DeepLinkState>,
    payload: String,
    active_network_id: String,
) -> Result<bool, String> {
    if state.peek().as_deref() != Some(payload.as_str()) {
        return Ok(false);
    }
    let [network_id, ..] = crate::deep_link::replay_parts_from_envelope_payload(&payload)?;
    if network_id != active_network_id {
        return Ok(false);
    }
    let replay_key = crate::deep_link::replay_key_from_envelope_payload(&payload)?;
    if !state.record_nonce(&app, &replay_key)? {
        return Ok(false);
    }
    state.mark_request_accepted(&payload)?;
    Ok(true)
}

#[tauri::command]
pub fn authorize_pending_request(
    state: State<'_, DeepLinkState>,
    payload: String,
    dapp_origin: String,
    request_hash: String,
    account_index: usize,
    intent: String,
) -> Result<String, String> {
    state.authorize_request(&payload, &dapp_origin, &request_hash, account_index, intent)
}

#[tauri::command]
pub fn take_pending_pay(state: State<'_, DeepLinkState>) -> Option<String> {
    state.take_payment()
}
