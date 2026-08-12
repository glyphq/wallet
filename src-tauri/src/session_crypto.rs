use std::{sync::Mutex, time::{Duration, Instant}};

use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::qubic_native;
use zeroize::Zeroizing;

const MAX_SIGN_MESSAGE_BYTES: usize = 64 * 1024;
const MIN_SIGN_INTERVAL: Duration = Duration::from_millis(750);

fn remaining_signing_quota(last: Option<Instant>, now: Instant) -> Duration {
    last.and_then(|previous| MIN_SIGN_INTERVAL.checked_sub(now.duration_since(previous)))
        .unwrap_or_default()
}

pub struct NativeSessionState {
    seeds: Mutex<Vec<Zeroizing<Vec<u8>>>>,
    last_signature: Mutex<Option<Instant>>,
    signing_gate: tokio::sync::Mutex<()>,
}

impl Default for NativeSessionState {
    fn default() -> Self {
        Self {
            seeds: Mutex::new(Vec::new()),
            last_signature: Mutex::new(None),
            signing_gate: tokio::sync::Mutex::new(()),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignTransactionRequest {
    account_index: usize,
    destination: String,
    amount: String,
    target_tick: u32,
    current_tick: Option<u32>,
    input_type: u16,
    payload: Vec<u8>,
}

#[derive(Serialize)]
pub struct SignedTxResult {
    encoded: String,
    hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignMessageRequest {
    account_index: usize,
    message_bytes: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignMessageResult {
    signature: Vec<u8>,
    public_key: Vec<u8>,
    identity: String,
}

impl NativeSessionState {
    pub fn replace_seeds(&self, seeds: Vec<String>) {
        self.clear();
        let mut guard = self.seeds.lock().expect("native session mutex poisoned");
        *guard = seeds.into_iter().map(|seed| Zeroizing::new(seed.into_bytes())).collect();
    }

    pub fn clear(&self) {
        let mut guard = self.seeds.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.clear();
        *self.last_signature.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    }

    fn with_seed_at_locked<T>(&self, account_index: usize, f: impl FnOnce(&str) -> Result<T, String>) -> Result<T, String> {
        let now = Instant::now();
        let mut last = self.last_signature.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if last.is_some_and(|previous| now.duration_since(previous) < MIN_SIGN_INTERVAL) {
            return Err("signing is temporarily rate limited".to_string());
        }
        *last = Some(now);
        drop(last);
        let guard = self.seeds.lock().map_err(|_| "native session unavailable".to_string())?;
        let seed = guard
            .get(account_index)
            .ok_or_else(|| "unlocked account not available".to_string())?;
        let seed = std::str::from_utf8(seed).map_err(|_| "session seed is invalid UTF-8".to_string())?;
        f(seed)
    }

    async fn with_seed_at<T>(&self, account_index: usize, f: impl FnOnce(&str) -> Result<T, String>) -> Result<T, String> {
        let _gate = self.signing_gate.lock().await;
        self.with_seed_at_locked(account_index, f)
    }

    async fn with_seed_at_waiting_for_quota<T>(
        &self,
        account_index: usize,
        f: impl FnOnce(&str) -> Result<T, String>,
    ) -> Result<T, String> {
        let _gate = self.signing_gate.lock().await;
        let wait = {
            let last = self.last_signature.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
            remaining_signing_quota(*last, Instant::now())
        };
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }
        self.with_seed_at_locked(account_index, f)
    }
}

#[cfg(test)]
mod tests {
    use super::{remaining_signing_quota, Duration, Instant, MIN_SIGN_INTERVAL};

    #[test]
    fn callback_wait_is_only_the_remaining_signing_quota() {
        let now = Instant::now();
        assert_eq!(remaining_signing_quota(None, now), Duration::ZERO);
        assert!(remaining_signing_quota(Some(now), now) >= MIN_SIGN_INTERVAL);
        assert_eq!(remaining_signing_quota(Some(now - MIN_SIGN_INTERVAL), now), Duration::ZERO);
    }

    #[test]
    fn general_signing_interval_remains_750_milliseconds() {
        assert_eq!(MIN_SIGN_INTERVAL, Duration::from_millis(750));
    }
}

#[command]
pub async fn store_session_seeds(
    state: State<'_, NativeSessionState>,
    seeds: Vec<String>,
) -> Result<(), String> {
    state.replace_seeds(seeds);
    Ok(())
}

#[command]
pub async fn clear_session_seeds(state: State<'_, NativeSessionState>) -> Result<(), String> {
    state.clear();
    Ok(())
}

#[command]
pub async fn sign_transaction(
    state: State<'_, NativeSessionState>,
    request: SignTransactionRequest,
) -> Result<SignedTxResult, String> {
    let amount = request
        .amount
        .parse::<i64>()
        .map_err(|_| "amount must fit signed 64-bit integer".to_string())?;
    if amount < 0 {
        return Err("amount must not be negative".to_string());
    }
    state.with_seed_at(request.account_index, |seed| {
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
    }).await
}

#[command]
pub async fn sign_message(
    state: State<'_, NativeSessionState>,
    request: SignMessageRequest,
) -> Result<SignMessageResult, String> {
    if request.message_bytes.len() > MAX_SIGN_MESSAGE_BYTES {
        return Err("message exceeds the native signing limit".to_string());
    }
    state.with_seed_at(request.account_index, |seed| {
        let (signature, public_key, identity) = qubic_native::sign_message(seed, &request.message_bytes)?;
        Ok(SignMessageResult { signature, public_key, identity })
    }).await
}

#[command]
pub async fn sign_callback_message(
    state: State<'_, NativeSessionState>,
    request: SignMessageRequest,
) -> Result<SignMessageResult, String> {
    if request.message_bytes.len() > MAX_SIGN_MESSAGE_BYTES {
        return Err("callback payload exceeds the native signing limit".to_string());
    }
    state.with_seed_at_waiting_for_quota(request.account_index, |seed| {
        let (signature, public_key, identity) = qubic_native::sign_message(seed, &request.message_bytes)?;
        Ok(SignMessageResult { signature, public_key, identity })
    }).await
}
