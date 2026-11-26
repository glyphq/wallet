//! Plugin registration, in the original startup order, and managed state.

use tauri::Manager;

use crate::auto_lock::AutoLockState;
use crate::clipboard::ClipboardState;
use crate::commands::HideToTrayState;
use crate::deep_link::{self, DeepLinkState};
use crate::session_crypto::NativeSessionState;

use super::launch::single_instance_url;
use super::notification_window::NotificationOverlayState;

pub(crate) fn register(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let accepted = match single_instance_url(&args) {
                Ok(Some(url)) => deep_link::process_url(app, url),
                Ok(None) => true,
                Err(()) => false,
            };
            if accepted {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_device_info::init())
}

pub(crate) fn manage_state(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .manage(AutoLockState::default())
        .manage(DeepLinkState::default())
        .manage(ClipboardState::default())
        .manage(HideToTrayState::default())
        .manage(NativeSessionState::default())
        .manage(NotificationOverlayState::default())
}
