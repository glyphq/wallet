//! Window-behavior and updater-context commands.

use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::State;

/// Whether closing the main window should hide it to the tray instead of exiting.
pub struct HideToTrayState(pub AtomicBool);

impl Default for HideToTrayState {
    fn default() -> Self {
        HideToTrayState(AtomicBool::new(false))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterContext {
    platform: &'static str,
    package_kind: &'static str,
    supports_auto_update: bool,
    reason: Option<&'static str>,
}

#[tauri::command]
pub fn set_hide_to_tray(state: State<'_, HideToTrayState>, enabled: bool) {
    state.0.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn get_updater_context() -> UpdaterContext {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("APPIMAGE").is_some() {
            return UpdaterContext {
                platform: "linux",
                package_kind: "appimage",
                supports_auto_update: true,
                reason: None,
            };
        }
        UpdaterContext {
            platform: "linux",
            package_kind: "system_package",
            supports_auto_update: false,
            reason: Some("Glyph Wallet's Linux updater currently targets the AppImage release path. deb/rpm installs must be updated through the system package you installed."),
        }
    }

    #[cfg(target_os = "windows")]
    {
        UpdaterContext {
            platform: "windows",
            package_kind: "nsis",
            supports_auto_update: true,
            reason: None,
        }
    }

    #[cfg(target_os = "macos")]
    {
        UpdaterContext {
            platform: "macos",
            package_kind: "app_bundle",
            supports_auto_update: true,
            reason: None,
        }
    }
}
