//! Main-window lifecycle: hide-to-tray on close and clipboard cleanup.

use std::sync::atomic::Ordering;

use tauri::Manager;

use crate::clipboard::ClipboardState;
use crate::commands::HideToTrayState;

pub(crate) fn handle_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    #[cfg(target_os = "windows")]
    if let Ok(hwnd) = window.hwnd() {
        crate::app::setup::set_square_corners(hwnd.0 as isize);
    }

    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == crate::app::approval_window::LABEL {
            api.prevent_close();
            let _ = window.hide();
            return;
        }
        let hide = window
            .app_handle()
            .state::<HideToTrayState>()
            .0
            .load(Ordering::Relaxed);
        if hide {
            api.prevent_close();
            let _ = window.hide();
        } else {
            let app = window.app_handle();
            let clipboard = app.state::<ClipboardState>();
            clipboard.clear_if_owned(app);
        }
    } else if let tauri::WindowEvent::Destroyed = event {
        let app = window.app_handle();
        let clipboard = app.state::<ClipboardState>();
        clipboard.clear_if_owned(app);
    }
}
