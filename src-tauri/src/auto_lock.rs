use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

pub struct AutoLockState {
    last_activity: Arc<Mutex<Instant>>,
    timeout_minutes: Arc<Mutex<u64>>,
    enabled: Arc<Mutex<bool>>,
}

impl Default for AutoLockState {
    fn default() -> Self {
        Self {
            last_activity: Arc::new(Mutex::new(Instant::now())),
            timeout_minutes: Arc::new(Mutex::new(15)),
            enabled: Arc::new(Mutex::new(true)),
        }
    }
}

impl AutoLockState {
    pub fn reset(&self) {
        *self.last_activity.lock().unwrap() = Instant::now();
    }

    pub fn set_timeout(&self, minutes: u64) {
        *self.timeout_minutes.lock().unwrap() = minutes;
        *self.enabled.lock().unwrap() = minutes > 0;
    }

    pub fn seconds_until_lock(&self) -> Option<u64> {
        let enabled = *self.enabled.lock().unwrap();
        if !enabled {
            return None;
        }
        let timeout = Duration::from_secs(*self.timeout_minutes.lock().unwrap() * 60);
        let elapsed = self.last_activity.lock().unwrap().elapsed();
        timeout.checked_sub(elapsed).map(|r| r.as_secs())
    }
}

pub fn spawn_lock_watcher(app: AppHandle) {
    let state = app.state::<AutoLockState>();
    let last_activity = Arc::clone(&state.last_activity);
    let timeout_minutes = Arc::clone(&state.timeout_minutes);
    let enabled = Arc::clone(&state.enabled);

    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(10));

        let is_enabled = *enabled.lock().unwrap();
        if !is_enabled {
            continue;
        }

        let timeout = Duration::from_secs(*timeout_minutes.lock().unwrap() * 60);
        let elapsed = last_activity.lock().unwrap().elapsed();

        if elapsed >= timeout {
            app.emit("sigil:lock", ()).ok();
            // Reset so we don't spam lock events
            *last_activity.lock().unwrap() = Instant::now();
        }
    });
}
