use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub struct ClipboardState {
    clear_at: Arc<(Mutex<Option<Instant>>, Condvar)>,
}

impl Default for ClipboardState {
    fn default() -> Self {
        Self {
            clear_at: Arc::new((Mutex::new(None), Condvar::new())),
        }
    }
}

impl ClipboardState {
    fn lock_recover(m: &Mutex<Option<Instant>>) -> std::sync::MutexGuard<'_, Option<Instant>> {
        m.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn schedule_clear(&self, after_secs: u64) {
        let (lock, cvar) = &*self.clear_at;
        *Self::lock_recover(lock) = if after_secs == 0 {
            None
        } else {
            Some(Instant::now() + Duration::from_secs(after_secs))
        };
        cvar.notify_one();
    }

    pub fn cancel_clear(&self) {
        let (lock, cvar) = &*self.clear_at;
        *Self::lock_recover(lock) = None;
        cvar.notify_one();
    }

    pub fn has_pending_clear(&self) -> bool {
        let (lock, _) = &*self.clear_at;
        Self::lock_recover(lock).is_some()
    }
}

pub fn spawn_clipboard_watcher(app: AppHandle) {
    let state = app.state::<ClipboardState>();
    let clipboard_state = ClipboardState {
        clear_at: Arc::clone(&state.clear_at),
    };

    std::thread::spawn(move || loop {
        let (lock, cvar) = &*clipboard_state.clear_at;
        let mut clear_at = ClipboardState::lock_recover(lock);

        while clear_at.is_none() {
            clear_at = cvar.wait(clear_at).unwrap_or_else(|e| e.into_inner());
        }

        while let Some(deadline) = *clear_at {
            let now = Instant::now();
            if now >= deadline {
                app.clipboard().write_text("").ok();
                *clear_at = None;
                break;
            }

            let wait_for = deadline.saturating_duration_since(now);
            let (next_clear_at, timeout_result) = cvar
                .wait_timeout(clear_at, wait_for)
                .unwrap_or_else(|e| e.into_inner());
            clear_at = next_clear_at;
            if timeout_result.timed_out()
                && clear_at.map_or(false, |at| Instant::now() >= at)
            {
                app.clipboard().write_text("").ok();
                *clear_at = None;
                break;
            }
        }
    });
}
