use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::qubic_native;

#[derive(Default)]
pub struct NativeSessionState {
    seeds: Mutex<Vec<Vec<u8>>>,
}

fn zeroize(bytes: &mut [u8]) {
    for b in bytes {
        *b = 0;
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
        *guard = seeds.into_iter().map(|seed| seed.into_bytes()).collect();
    }

    pub fn clear(&self) {
        if let Ok(mut guard) = self.seeds.lock() {
            for seed in guard.iter_mut() {
                zeroize(seed);
            }
            guard.clear();
        }
    }

    fn with_seed_at<T>(&self, account_index: usize, f: impl FnOnce(&str) -> Result<T, String>) -> Result<T, String> {
        let guard = self.seeds.lock().map_err(|_| "native session unavailable".to_string())?;
        let seed = guard
            .get(account_index)
            .ok_or_else(|| "unlocked account not available".to_string())?;
        let seed = std::str::from_utf8(seed).map_err(|_| "session seed is invalid UTF-8".to_string())?;
        f(seed)
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
    })
}

#[command]
pub async fn sign_message(
    state: State<'_, NativeSessionState>,
    request: SignMessageRequest,
) -> Result<SignMessageResult, String> {
    state.with_seed_at(request.account_index, |seed| {
        let (signature, public_key, identity) = qubic_native::sign_message(seed, &request.message_bytes)?;
        Ok(SignMessageResult { signature, public_key, identity })
    })
}
