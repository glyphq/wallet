use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

pub struct DeepLinkState {
    pending_request: Arc<Mutex<Option<String>>>,
}

impl Default for DeepLinkState {
    fn default() -> Self {
        Self {
            pending_request: Arc::new(Mutex::new(None)),
        }
    }
}

impl DeepLinkState {
    pub fn store(&self, payload: String) {
        *self.pending_request.lock().unwrap() = Some(payload);
    }

    pub fn take(&self) -> Option<String> {
        self.pending_request.lock().unwrap().take()
    }

    pub fn peek(&self) -> Option<String> {
        self.pending_request.lock().unwrap().clone()
    }
}

pub fn register_handler(app: &AppHandle) {
    let handle = app.clone();

    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            let raw = url.to_string();

            if !raw.starts_with("sigil://") {
                continue;
            }

            let state = handle.state::<DeepLinkState>();
            state.store(raw.clone());
            handle.emit("sigil:request", raw).ok();
        }
    });
}
