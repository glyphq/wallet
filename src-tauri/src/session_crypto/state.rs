//! Native session seed storage, zeroization and signing rate limiting.

use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

use zeroize::Zeroizing;

pub(super) const MAX_SESSION_SEEDS: usize = 16;
const QUBIC_SEED_LENGTH: usize = 55;
pub(super) const MIN_SIGN_INTERVAL: Duration = Duration::from_millis(750);

pub(crate) fn validate_session_seeds(seeds: &[String]) -> Result<(), String> {
    if seeds.is_empty() || seeds.len() > MAX_SESSION_SEEDS {
        return Err(format!(
            "session must contain between 1 and {MAX_SESSION_SEEDS} Qubic seeds"
        ));
    }
    if seeds.iter().any(|seed| {
        seed.len() != QUBIC_SEED_LENGTH || !seed.bytes().all(|byte| byte.is_ascii_lowercase())
    }) {
        return Err("session seeds must be 55 lowercase ASCII characters".to_string());
    }
    Ok(())
}

pub(super) fn remaining_signing_quota(last: Option<Instant>, now: Instant) -> Duration {
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

impl NativeSessionState {
    pub fn replace_seeds(&self, seeds: Vec<String>) {
        self.clear();
        let mut guard = self
            .seeds
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *guard = seeds
            .into_iter()
            .map(|seed| Zeroizing::new(seed.into_bytes()))
            .collect();
    }

    pub fn clear(&self) {
        let mut guard = self
            .seeds
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.clear();
        *self
            .last_signature
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    }

    fn with_seed_at_locked<T>(
        &self,
        account_index: usize,
        f: impl FnOnce(&str) -> Result<T, String>,
    ) -> Result<T, String> {
        let now = Instant::now();
        let mut last = self
            .last_signature
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if last.is_some_and(|previous| now.duration_since(previous) < MIN_SIGN_INTERVAL) {
            return Err("signing is temporarily rate limited".to_string());
        }
        *last = Some(now);
        drop(last);
        let guard = self
            .seeds
            .lock()
            .map_err(|_| "native session unavailable".to_string())?;
        let seed = guard
            .get(account_index)
            .ok_or_else(|| "unlocked account not available".to_string())?;
        let seed =
            std::str::from_utf8(seed).map_err(|_| "session seed is invalid UTF-8".to_string())?;
        f(seed)
    }

    pub(super) async fn with_seed_at<T>(
        &self,
        account_index: usize,
        f: impl FnOnce(&str) -> Result<T, String>,
    ) -> Result<T, String> {
        let _gate = self.signing_gate.lock().await;
        self.with_seed_at_locked(account_index, f)
    }

    pub(super) async fn with_seed_at_waiting_for_quota<T>(
        &self,
        account_index: usize,
        f: impl FnOnce(&str) -> Result<T, String>,
    ) -> Result<T, String> {
        let _gate = self.signing_gate.lock().await;
        let wait = {
            let last = self
                .last_signature
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            remaining_signing_quota(*last, Instant::now())
        };
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }
        self.with_seed_at_locked(account_index, f)
    }
}
