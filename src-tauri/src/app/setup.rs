//! Tauri setup hook: background watchers, deep-link handler and tray install.

use crate::{auto_lock, clipboard, deep_link};

use super::tray;

pub(crate) fn configure(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    deep_link::register_handler(&app.handle().clone());
    auto_lock::spawn_lock_watcher(app.handle().clone());
    clipboard::spawn_clipboard_watcher(app.handle().clone());

    #[cfg(target_os = "linux")]
    tray::install_linux_tray(app);

    #[cfg(not(target_os = "linux"))]
    tray::install_native_tray(app)?;

    #[cfg(target_os = "windows")]
    apply_square_window_corners(app);

    Ok(())
}

/// Windows 11 rounds top-level windows by default; the in-app frame uses sharp
/// corners, so keep the native window square to match it exactly.
#[cfg(target_os = "windows")]
fn apply_square_window_corners(app: &tauri::App) {
    use tauri::Manager;

    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWCP_DONOTROUND: i32 = 1;

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: isize,
            attribute: u32,
            value: *const core::ffi::c_void,
            size: u32,
        ) -> i32;
    }

    let Some(window) = app.get_webview_window("main") else { return };
    let Ok(hwnd) = window.hwnd() else { return };
    let preference = DWMWCP_DONOTROUND;
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd.0 as isize,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &preference as *const _ as *const core::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );
    }
}
