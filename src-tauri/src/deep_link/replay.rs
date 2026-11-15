//! Replay/nonce persistence. The nonce map is bounded by age and persisted so a
//! restart cannot reopen a previously accepted request.

use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use super::envelope::now_secs;
use super::state::DeepLinkState;
use super::{MAX_NONCE_AGE_SECS, NONCE_STORE_KEY, NONCE_STORE_PATH};

impl DeepLinkState {
    fn prune_seen_nonces(seen: &mut HashMap<String, u64>, now: u64) {
        seen.retain(|_, &mut inserted_at| now.saturating_sub(inserted_at) < MAX_NONCE_AGE_SECS);
    }

    pub fn load_seen_nonces(&self, app: &AppHandle) {
        let Ok(store) = app.store(NONCE_STORE_PATH) else {
            return;
        };
        let Some(value) = store.get(NONCE_STORE_KEY) else {
            return;
        };
        let Ok(mut seen) = serde_json::from_value::<HashMap<String, u64>>(value) else {
            return;
        };
        Self::prune_seen_nonces(&mut seen, now_secs());
        *self.seen_nonces.lock().unwrap_or_else(|e| e.into_inner()) = seen;
    }

    fn persist_seen_nonces(app: &AppHandle, seen: &HashMap<String, u64>) -> Result<(), String> {
        let store = app
            .store(NONCE_STORE_PATH)
            .map_err(|error| format!("could not open replay protection storage: {error}"))?;
        let value = serde_json::to_value(seen)
            .map_err(|error| format!("could not serialize replay protection storage: {error}"))?;
        store.set(NONCE_STORE_KEY, value);
        store
            .save()
            .map_err(|error| format!("could not persist replay protection storage: {error}"))
    }

    /// Returns false if the replay key was already seen within the last hour (replay), true if fresh.
    /// The map mutex is held through persistence so a stale snapshot cannot overwrite a newer nonce.
    pub fn record_nonce(&self, app: &AppHandle, nonce: &str) -> Result<bool, String> {
        let mut seen = self.seen_nonces.lock().unwrap_or_else(|e| e.into_inner());
        let now = now_secs();
        Self::prune_seen_nonces(&mut seen, now);
        if seen.contains_key(nonce) {
            return Ok(false);
        }
        seen.insert(nonce.to_string(), now);
        if let Err(error) = Self::persist_seen_nonces(app, &seen) {
            seen.remove(nonce);
            return Err(error);
        }
        Ok(true)
    }
}
