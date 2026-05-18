use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub struct ClipboardState {
    clear_at: Arc<Mutex<Option<Instant>>>,
}

impl Default for ClipboardState {
    fn default() -> Self {
        Self {
            clear_at: Arc::new(Mutex::new(None)),
        }
    }
}

impl ClipboardState {
    pub fn schedule_clear(&self, after_secs: u64) {
        if after_secs == 0 {
            *self.clear_at.lock().unwrap() = None;
            return;
        }
        *self.clear_at.lock().unwrap() =
            Some(Instant::now() + Duration::from_secs(after_secs));
    }

    pub fn cancel_clear(&self) {
        *self.clear_at.lock().unwrap() = None;
    }

    pub fn should_clear(&self) -> bool {
        let guard = self.clear_at.lock().unwrap();
        guard.map_or(false, |at| Instant::now() >= at)
    }
}

pub fn spawn_clipboard_watcher(app: AppHandle) {
    let state = app.state::<ClipboardState>();
    let clear_at = Arc::clone(&state.clear_at);

    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));

        let should_clear = {
            let guard = clear_at.lock().unwrap();
            guard.map_or(false, |at| Instant::now() >= at)
        };

        if should_clear {
            app.clipboard().write_text("").ok();
            *clear_at.lock().unwrap() = None;
        }
    });
}
