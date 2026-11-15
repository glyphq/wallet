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

    Ok(())
}
