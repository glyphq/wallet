use sha2::{Digest, Sha256};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

#[derive(Clone, Copy)]
struct PendingClear {
    deadline: Instant,
    digest: [u8; 32],
}

pub struct ClipboardState {
    clear_at: Arc<(Mutex<Option<PendingClear>>, Condvar)>,
}

impl Default for ClipboardState {
    fn default() -> Self {
        Self {
            clear_at: Arc::new((Mutex::new(None), Condvar::new())),
        }
    }
}

fn text_digest(text: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hasher.finalize().into()
}

fn matches_owned(digest: &[u8; 32], current: &str) -> bool {
    text_digest(current) == *digest
}

/// Only blank the clipboard while it still holds the value Glyph copied.
/// If the clipboard cannot be read, keep the previous security-first behavior
/// and clear anyway.
fn should_clear(app: &AppHandle, digest: &[u8; 32]) -> bool {
    match app.clipboard().read_text() {
        Ok(current) => matches_owned(digest, &current),
        Err(_) => true,
    }
}

impl ClipboardState {
    fn lock_recover(
        m: &Mutex<Option<PendingClear>>,
    ) -> std::sync::MutexGuard<'_, Option<PendingClear>> {
        m.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn schedule_clear(&self, after_secs: u64, text: &str) {
        let (lock, cvar) = &*self.clear_at;
        *Self::lock_recover(lock) = if after_secs == 0 {
            None
        } else {
            Some(PendingClear {
                deadline: Instant::now() + Duration::from_secs(after_secs),
                digest: text_digest(text),
            })
        };
        cvar.notify_one();
    }

    pub fn cancel_clear(&self) {
        let (lock, cvar) = &*self.clear_at;
        *Self::lock_recover(lock) = None;
        cvar.notify_one();
    }

    /// Clears the clipboard when Glyph still owns its contents.
    /// Returns true when the clipboard was cleared.
    pub fn clear_if_owned(&self, app: &AppHandle) -> bool {
        let (lock, cvar) = &*self.clear_at;
        let pending = {
            let mut guard = Self::lock_recover(lock);
            guard.take()
        };
        cvar.notify_one();

        let Some(pending) = pending else {
            return false;
        };
        if !should_clear(app, &pending.digest) {
            return false;
        }
        app.clipboard().write_text("").ok();
        true
    }
}

pub fn spawn_clipboard_watcher(app: AppHandle) {
    let state = app.state::<ClipboardState>();
    let clipboard_state = ClipboardState {
        clear_at: Arc::clone(&state.clear_at),
    };

    std::thread::spawn(move || {
        let (lock, cvar) = &*clipboard_state.clear_at;
        let mut pending = ClipboardState::lock_recover(lock);

        loop {
            while pending.is_none() {
                pending = cvar.wait(pending).unwrap_or_else(|e| e.into_inner());
            }

            while let Some(clear) = *pending {
                let now = Instant::now();
                if now >= clear.deadline {
                    *pending = None;
                    if should_clear(&app, &clear.digest) {
                        app.clipboard().write_text("").ok();
                    }
                    break;
                }

                let wait_for = clear.deadline.saturating_duration_since(now);
                pending = cvar
                    .wait_timeout(pending, wait_for)
                    .unwrap_or_else(|e| e.into_inner())
                    .0;
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digests_are_stable_and_value_specific() {
        assert_eq!(text_digest("seed"), text_digest("seed"));
        assert_ne!(text_digest("seed"), text_digest("seed "));
    }

    #[test]
    fn ownership_requires_the_original_value() {
        let digest = text_digest("copied value");
        assert!(matches_owned(&digest, "copied value"));
        assert!(!matches_owned(&digest, "something the user copied later"));
        assert!(!matches_owned(&digest, ""));
    }
}
