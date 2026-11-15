//! Tray icon installation.
//!
//! Linux uses a direct freedesktop StatusNotifierItem implementation (ksni) so
//! the app does not depend on the deprecated libayatana-appindicator backend;
//! other platforms use Tauri's tray-icon feature.

use tauri::Manager;

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
pub(crate) fn install_linux_tray(app: &tauri::App) {
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

#[cfg(not(target_os = "linux"))]
pub(crate) fn install_native_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show_i = MenuItem::with_id(app, "show", "Open Glyph Wallet", true, None::<&str>)?;
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
            eprintln!("[glyph] tray icon unavailable; continuing without tray support: {err}");
        }
    } else {
        eprintln!("[glyph] tray icon disabled: default window icon unavailable");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "linux")]
    use super::linux_tray_icon;

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
