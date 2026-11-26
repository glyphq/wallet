use super::envelope::{
    callback_from_envelope_payload, jcs, now_secs, replay_key_from_envelope_payload,
    sha256_base64url,
};
use super::pay::validate_pay;
use super::request::validate;
use super::state::DeepLinkState;
use super::url::{validate_dapp_origin, validate_delivery_url};
use super::{CALLBACK_ENVELOPE_VERSION_V2, MAX_PENDING_LINKS, REQUEST_PROTOCOL_V2};
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

fn sc_call_request_url(contract_index: i64, input_type: i64) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

    let envelope = serde_json::json!({
        "protocol": REQUEST_PROTOCOL_V2,
        "request": {
            "type": "sc_call",
            "dapp": { "name": "Demo", "origin": "https://demo.app" },
            "nonce": "5b4bf4a7a53f4f29892892520dcaeffb",
            "exp": now_secs() + 300,
            "contract_index": contract_index,
            "input_type": input_type,
            "amount": "1",
        },
        "callback": null,
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
    format!(
        "glyph://v2/request?d={}",
        URL_SAFE_NO_PAD.encode(envelope.to_string())
    )
}

#[test]
fn sc_call_bounds_match_native_signing_types() {
    assert!(validate(&sc_call_request_url(63, 65_535)).is_ok());
    assert!(validate(&sc_call_request_url(64, 1)).is_err());
    assert!(validate(&sc_call_request_url(0, 65_536)).is_err());
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
