//! Signing/callback capability lifecycle. Every capability is bound to the
//! reviewed request, the origin, the account, and a single use.

use serde_json::Value;
use std::sync::atomic::Ordering;

use super::callback::validate_callback_message;
use super::envelope::{
    now_secs, replay_parts_from_envelope_payload, sha256_base64url, sha256_base64url_bytes,
};
use super::state::DeepLinkState;
use super::MAX_SIGNING_AUTHORIZATION_AGE_SECS;

#[derive(Clone, Debug)]
pub(super) struct SigningAuthorization {
    pub(super) kind: AuthorizationKind,
    pub(super) payload: Option<String>,
    pub(super) dapp_origin: Option<String>,
    pub(super) account_index: usize,
    pub(super) intent: String,
    pub(super) expires_at: u64,
    pub(super) user_consumed: bool,
    pub(super) callback_hash: Option<String>,
    pub(super) expected_operation: Option<ExpectedOperation>,
    pub(super) expected_callback_identity: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum AuthorizationKind {
    UserOperation,
    CallbackOnly,
    BoundCallback,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum ExpectedOperation {
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

impl DeepLinkState {
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
