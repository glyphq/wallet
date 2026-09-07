mod auto_lock;
mod biometric;
mod clipboard;
mod commands;
mod deep_link;
pub mod link_broker;
mod qubic_native;
mod session_crypto;
mod store_crypto;
mod vault_crypto;

use std::sync::atomic::Ordering;

use auto_lock::AutoLockState;
use clipboard::ClipboardState;
use commands::HideToTrayState;
use deep_link::DeepLinkState;
use session_crypto::NativeSessionState;
#[cfg(not(target_os = "linux"))]
use tauri::menu::{Menu, MenuItem};
#[cfg(not(target_os = "linux"))]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;

fn single_instance_url(args: &[String]) -> Result<Option<&str>, ()> {
    match args {
        [_executable] => Ok(None),
        [_executable, url] if link_broker::validate_launch_url(url).is_ok() => Ok(Some(url)),
        _ => Err(()),
    }
}

#[cfg(target_os = "linux")]
fn configure_linux_runtime() {
    let is_wsl = std::env::var_os("WSL_DISTRO_NAME").is_some()
        || std::fs::read_to_string("/proc/sys/kernel/osrelease")
            .map(|release| release.to_ascii_lowercase().contains("microsoft"))
            .unwrap_or(false);

    if is_wsl {
        // WSLg's virtual GPU can expose EGL while failing WebKitGTK's accelerated
        // compositor initialization, producing a window with no rendered content.
        // Keep this scoped to WSL so normal Linux desktops retain acceleration.
        if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }
}

#[cfg(target_os = "linux")]
struct LinuxTray<R: tauri::Runtime> {
    app: tauri::AppHandle<R>,
    icon: ksni::Icon,
}

#[cfg(target_os = "linux")]
impl<R: tauri::Runtime> LinuxTray<R> {
    fn reveal_wallet(&self) {
        if let Some(window) = self.app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg(target_os = "linux")]
impl<R: tauri::Runtime> ksni::Tray for LinuxTray<R> {
    fn id(&self) -> String {
        "com.qubic.glyph".into()
    }

    fn title(&self) -> String {
        "Glyph Wallet".into()
    }

    fn icon_pixmap(&self) -> Vec<ksni::Icon> {
        vec![self.icon.clone()]
    }

    fn activate(&mut self, _x: i32, _y: i32) {
        self.reveal_wallet();
    }

    fn menu(&self) -> Vec<ksni::MenuItem<Self>> {
        use ksni::menu::StandardItem;

        vec![
            StandardItem {
                label: "Open Glyph Wallet".into(),
                activate: Box::new(|tray: &mut Self| tray.reveal_wallet()),
                ..Default::default()
            }
            .into(),
            StandardItem {
                label: "Quit".into(),
                activate: Box::new(|tray: &mut Self| tray.app.exit(0)),
                ..Default::default()
            }
            .into(),
        ]
    }
}

#[cfg(target_os = "linux")]
fn linux_tray_icon(icon: &tauri::image::Image<'_>) -> ksni::Icon {
    let mut data = icon.rgba().to_vec();
    for pixel in data.chunks_exact_mut(4) {
        pixel.rotate_right(1); // RGBA to the ARGB32 bytes required by StatusNotifierItem.
    }
    ksni::Icon {
        width: icon.width() as i32,
        height: icon.height() as i32,
        data,
    }
}

#[cfg(target_os = "linux")]
fn install_linux_tray<R: tauri::Runtime>(app: &tauri::App<R>) {
    use ksni::blocking::TrayMethods;

    let Some(icon) = app.default_window_icon().cloned() else {
        eprintln!("[glyph] tray icon disabled: default window icon unavailable");
        return;
    };

    if let Err(err) = (LinuxTray {
        app: app.handle().clone(),
        icon: linux_tray_icon(&icon),
    })
    .spawn()
    {
        // A missing StatusNotifier host must not prevent the main wallet window from opening.
        eprintln!("[glyph] tray icon unavailable; continuing without tray support: {err}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    configure_linux_runtime();

    // When running as an AppImage, point TMPDIR at the AppImage's own directory so the
    // updater downloads to the same filesystem — avoids cross-device rename failures and
    // noexec-tmpfs permission errors that block in-place AppImage replacement.
    #[cfg(target_os = "linux")]
    if let Ok(appimage) = std::env::var("APPIMAGE") {
        if let Some(parent) = std::path::Path::new(&appimage).parent() {
            std::env::set_var("TMPDIR", parent);
        }
    }

    tauri::Builder::default()
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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_device_info::init())
        .manage(AutoLockState::default())
        .manage(DeepLinkState::default())
        .manage(ClipboardState::default())
        .manage(HideToTrayState::default())
        .manage(NativeSessionState::default())
        .setup(|app| {
            deep_link::register_handler(&app.handle().clone());
            auto_lock::spawn_lock_watcher(app.handle().clone());
            clipboard::spawn_clipboard_watcher(app.handle().clone());

            #[cfg(target_os = "linux")]
            install_linux_tray(app);

            #[cfg(not(target_os = "linux"))]
            {
                let show_i =
                    MenuItem::with_id(app, "show", "Open Glyph Wallet", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

                if let Some(icon) = app.default_window_icon().cloned() {
                    if let Err(err) = TrayIconBuilder::new()
                        .icon(icon)
                        .menu(&menu)
                        .show_menu_on_left_click(false)
                        .on_menu_event(|app, event| match event.id.as_ref() {
                            "show" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            "quit" => app.exit(0),
                            _ => {}
                        })
                        .on_tray_icon_event(|tray, event| {
                            if let TrayIconEvent::Click {
                                button: MouseButton::Left,
                                button_state: MouseButtonState::Up,
                                ..
                            } = event
                            {
                                let app = tray.app_handle();
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                        })
                        .build(app)
                    {
                        eprintln!(
                            "[glyph] tray icon unavailable; continuing without tray support: {err}"
                        );
                    }
                } else {
                    eprintln!("[glyph] tray icon disabled: default window icon unavailable");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
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
                    if clipboard.has_pending_clear() {
                        let _ = app.clipboard().write_text("");
                        clipboard.cancel_clear();
                    }
                }
            } else if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let clipboard = app.state::<ClipboardState>();
                if clipboard.has_pending_clear() {
                    let _ = app.clipboard().write_text("");
                    clipboard.cancel_clear();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::reset_activity_timer,
            commands::set_lock_timeout,
            commands::set_lock_on_sleep,
            commands::get_seconds_until_lock,
            commands::force_lock,
            commands::get_pending_request,
            commands::clear_pending_request,
            commands::accept_pending_request,
            commands::authorize_pending_request,
            session_crypto::authorize_callback_message,
            commands::take_pending_pay,
            commands::copy_to_clipboard,
            commands::clear_clipboard,
            commands::lock_clipboard,
            commands::post_callback,
            commands::set_hide_to_tray,
            commands::get_updater_context,
            store_crypto::encrypt_store_value,
            store_crypto::decrypt_store_value,
            vault_crypto::encrypt_vault,
            vault_crypto::unlock_vault_session,
            vault_crypto::verify_vault_password,
            vault_crypto::add_seed_to_vault,
            vault_crypto::remove_seed_from_vault,
            vault_crypto::select_vault_accounts,
            vault_crypto::rotate_vault_password,
            vault_crypto::reveal_vault_seed,
            session_crypto::store_session_seeds,
            session_crypto::clear_session_seeds,
            session_crypto::sign_transaction,
            session_crypto::sign_local_transaction,
            session_crypto::sign_message,
            session_crypto::sign_local_message,
            session_crypto::sign_callback_message,
            biometric::check_biometric_available,
            biometric::enable_biometric,
            biometric::biometric_unlock,
            biometric::reveal_seed_with_biometric,
            biometric::disable_biometric,
        ])
        .run(tauri::generate_context!())
        .expect("error while running glyph");
}

#[cfg(test)]
mod tests {
    use super::single_instance_url;

    #[cfg(target_os = "linux")]
    use super::linux_tray_icon;

    #[test]
    fn accepts_only_normal_launch_or_one_valid_link() {
        let executable = "glyph-wallet".to_string();
        let valid = "glyph://v2/request?d=YWJjZA".to_string();
        assert_eq!(
            single_instance_url(std::slice::from_ref(&executable)),
            Ok(None)
        );
        assert_eq!(
            single_instance_url(&[executable.clone(), valid.clone()]),
            Ok(Some(valid.as_str()))
        );
        assert!(single_instance_url(&[executable.clone(), "--inspect".into()]).is_err());
        assert!(single_instance_url(&[
            executable,
            "glyph://v1/request?d=abc".into(),
            "glyph://pay?to=abc".into(),
        ])
        .is_err());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_tray_icon_uses_status_notifier_argb_pixels() {
        let image = tauri::image::Image::new(&[0x10, 0x20, 0x30, 0x40], 1, 1);
        let icon = linux_tray_icon(&image);

        assert_eq!(icon.width, 1);
        assert_eq!(icon.height, 1);
        assert_eq!(icon.data, vec![0x40, 0x10, 0x20, 0x30]);
    }
}
