use std::sync::Mutex;

use tauri::{command, State};
#[derive(Default)]
pub struct NativeSessionState {
    seeds: Mutex<Vec<Vec<u8>>>,
}

fn zeroize(bytes: &mut [u8]) {
    for b in bytes {
        *b = 0;
    }
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

    fn seed_at(&self, account_index: usize) -> Result<String, String> {
        let guard = self.seeds.lock().map_err(|_| "native session unavailable".to_string())?;
        let seed = guard
            .get(account_index)
            .ok_or_else(|| "unlocked account not available".to_string())?;
        String::from_utf8(seed.clone()).map_err(|_| "session seed is invalid UTF-8".to_string())
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
pub async fn get_session_seed_for_signing(
    state: State<'_, NativeSessionState>,
    account_index: usize,
) -> Result<String, String> {
    // The Qubic signing implementation currently lives in TypeScript. Keep the
    // long-lived unlocked seed set native-side and release only a one-shot clone
    // for the existing signing worker until signing is ported fully to Rust.
    state.seed_at(account_index)
}
