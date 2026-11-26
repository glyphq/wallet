//! Tests for session seed validation, rate limiting and review binding.

use std::time::{Duration, Instant};

use super::authorization::{ensure_transaction_matches_request, SignTransactionRequest};
use super::state::{
    remaining_signing_quota, validate_session_seeds, MAX_SESSION_SEEDS, MIN_SIGN_INTERVAL,
};

#[test]
fn callback_wait_is_only_the_remaining_signing_quota() {
    let now = Instant::now();
    assert_eq!(remaining_signing_quota(None, now), Duration::ZERO);
    assert!(remaining_signing_quota(Some(now), now) >= MIN_SIGN_INTERVAL);
    assert_eq!(
        remaining_signing_quota(Some(now - MIN_SIGN_INTERVAL), now),
        Duration::ZERO
    );
}

#[test]
fn general_signing_interval_remains_750_milliseconds() {
    assert_eq!(MIN_SIGN_INTERVAL, Duration::from_millis(750));
}

#[test]
fn rejects_invalid_session_seed_sets_before_storing_them() {
    assert!(validate_session_seeds(&[]).is_err());
    assert!(validate_session_seeds(&["A".repeat(55)]).is_err());
    assert!(validate_session_seeds(&["a".repeat(54)]).is_err());
    assert!(validate_session_seeds(&vec!["a".repeat(55); MAX_SESSION_SEEDS + 1]).is_err());
    assert!(validate_session_seeds(&["a".repeat(55)]).is_ok());
}

#[test]
fn smart_contract_destination_is_bound_to_the_reviewed_contract_index() {
    let destination = crate::qubic_native::contract_index_to_identity(1).unwrap();
    let payload = serde_json::json!({
        "request": {
            "type": "sc_call",
            "amount": 0,
            "contract_index": 1,
            "input_type": 7,
            "payload": "",
        }
    })
    .to_string();
    let request = SignTransactionRequest {
        account_index: 0,
        destination: destination.clone(),
        amount: "0".into(),
        target_tick: 1,
        current_tick: None,
        input_type: 7,
        payload: vec![],
        authorization: "auth".into(),
        request_payload: Some(payload.clone()),
        dapp_origin: Some("https://demo.app".into()),
        intent: "intent".into(),
    };
    assert!(ensure_transaction_matches_request(&payload, &request, 0).is_ok());

    let mut altered = request;
    altered.destination = crate::qubic_native::contract_index_to_identity(2).unwrap();
    assert!(ensure_transaction_matches_request(&payload, &altered, 0).is_err());
}

#[test]
fn transfers_cannot_include_unreviewed_input_or_payload() {
    let payload = serde_json::json!({
        "request": {
            "type": "transfer",
            "amount": 1,
            "to": "DESTINATION",
        }
    })
    .to_string();
    let request = SignTransactionRequest {
        account_index: 0,
        destination: "DESTINATION".into(),
        amount: "1".into(),
        target_tick: 1,
        current_tick: None,
        input_type: 0,
        payload: vec![],
        authorization: "auth".into(),
        request_payload: Some(payload.clone()),
        dapp_origin: Some("https://demo.app".into()),
        intent: "intent".into(),
    };
    assert!(ensure_transaction_matches_request(&payload, &request, 1).is_ok());

    let mut input_type = request.clone();
    input_type.input_type = 1;
    assert!(ensure_transaction_matches_request(&payload, &input_type, 1).is_err());

    let mut payload_bytes = request;
    payload_bytes.payload = vec![1];
    assert!(ensure_transaction_matches_request(&payload, &payload_bytes, 1).is_err());
}
