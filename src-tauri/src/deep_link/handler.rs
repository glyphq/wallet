//! Deep link entry points wired into the Tauri runtime.

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

use super::pay::validate_pay;
use super::request::validate;
use super::state::DeepLinkState;
use super::REQUEST_PROTOCOL_V2;

pub fn process_url(app: &AppHandle, raw: &str) -> bool {
    let kind = match crate::link_broker::validate_launch_url(raw) {
        Ok(kind) => kind,
        Err(error) => {
            eprintln!("[glyph] launch link rejected: {error}");
            return false;
        }
    };

    if kind == crate::link_broker::LinkKind::Pay {
        match validate_pay(raw) {
            Ok(pay) => {
                let payload = serde_json::json!({
                    "to": pay.to,
                    "amount": pay.amount,
                    "label": pay.label,
                });
                let payload = payload.to_string();
                app.state::<DeepLinkState>().store_payment(payload);
                app.emit("glyph:pay", ()).ok();
                return true;
            }
            Err(e) => {
                eprintln!("[glyph] pay link rejected: {e}");
            }
        }
        return false;
    }

    match validate(raw) {
        Ok(parsed) => {
            let state = app.state::<DeepLinkState>();
            let envelope = serde_json::json!({
                "protocol": REQUEST_PROTOCOL_V2,
                "request": parsed.request,
                "callback": parsed.callback,
                "redirect_uri": parsed.redirect_uri,
                "network": parsed.network,
                "request_hash": parsed.request_hash,
            });
            let payload = envelope.to_string();
            if state.store(payload.clone()) {
                app.emit("glyph:request", payload).ok();
                true
            } else {
                false
            }
        }
        Err(e) => {
            eprintln!("[glyph] deep link rejected: {e}");
            false
        }
    }
}

pub fn register_handler(app: &AppHandle) {
    app.state::<DeepLinkState>().load_seen_nonces(app);

    if let Ok(Some(urls)) = app.deep_link().get_current() {
        for url in urls {
            process_url(app, url.as_ref());
        }
    }

    let handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            process_url(&handle, url.as_ref());
        }
    });
}
