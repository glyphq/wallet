//! Dedicated secure window for reviewing external dApp requests.

use tauri::{AppHandle, Manager};

pub(crate) const LABEL: &str = "approval";

/// Shows the approval window and brings it to the front.
///
/// The window is declared in the application configuration so it is
/// constructed with the main window at startup and stays hidden until a
/// request arrives. Creating windows lazily on Windows can deadlock the
/// WebView2 controller.
pub(crate) fn show(app: &AppHandle) -> tauri::Result<()> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or_else(|| tauri::Error::WindowNotFound)?;
    window.show()?;
    window.set_focus()?;
    Ok(())
}
