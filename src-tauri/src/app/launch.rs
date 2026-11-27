//! Startup environment preparation and launch-argument parsing.

pub(crate) fn single_instance_url(args: &[String]) -> Result<Option<&str>, ()> {
    match args {
        [_executable] => Ok(None),
        [_executable, url] if crate::link_broker::validate_launch_url(url).is_ok() => Ok(Some(url)),
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

    let wayland_session = std::env::var_os("WAYLAND_DISPLAY").is_some()
        || std::env::var("XDG_SESSION_TYPE")
            .map(|value| value.eq_ignore_ascii_case("wayland"))
            .unwrap_or(false);
    if wayland_session && std::env::var_os("APPIMAGE").is_some() {
        // linuxdeploy's AppImage GTK hook forces GDK_BACKEND=x11. On Wayland
        // compositors that makes the app an XWayland client, where fractional
        // scaling and tiling/WM sizing diverge from the native window surface.
        // Restore Wayland first, retaining X11 as a fallback when available.
        std::env::set_var("GDK_BACKEND", "wayland,x11");
    }
}

/// Platform-specific environment adjustments that must run before the Tauri
/// builder starts.
pub(crate) fn configure_runtime() {
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
}

#[cfg(test)]
mod tests {
    use super::single_instance_url;

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
}
