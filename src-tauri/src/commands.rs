use std::net::{IpAddr, Ipv4Addr, SocketAddr, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};

use reqwest;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

pub struct HideToTrayState(pub AtomicBool);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterContext {
    platform: &'static str,
    package_kind: &'static str,
    supports_auto_update: bool,
    reason: Option<&'static str>,
}

impl Default for HideToTrayState {
    fn default() -> Self {
        HideToTrayState(AtomicBool::new(false))
    }
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
        return UpdaterContext {
            platform: "linux",
            package_kind: "system_package",
            supports_auto_update: false,
            reason: Some("Glyph's Linux updater currently targets the AppImage release path. deb/rpm installs must be updated through the system package you installed."),
        };
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

use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::auto_lock::{AutoLockState, MAX_LOCK_TIMEOUT_MINUTES, MIN_LOCK_TIMEOUT_MINUTES};
use crate::clipboard::ClipboardState;
use crate::deep_link::DeepLinkState;
use crate::session_crypto::NativeSessionState;

const MAX_CLIPBOARD_CLEAR_SECS: u64 = 300;

#[tauri::command]
pub fn reset_activity_timer(state: State<'_, AutoLockState>) {
    state.reset();
}

#[tauri::command]
pub fn set_lock_timeout(minutes: u64, state: State<'_, AutoLockState>) {
    state.set_timeout(minutes.clamp(MIN_LOCK_TIMEOUT_MINUTES, MAX_LOCK_TIMEOUT_MINUTES));
}

#[tauri::command]
pub fn set_lock_on_sleep(enabled: bool, state: State<'_, AutoLockState>) {
    state.set_lock_on_sleep(enabled);
}

#[tauri::command]
pub fn get_seconds_until_lock(state: State<'_, AutoLockState>) -> Option<u64> {
    state.seconds_until_lock()
}

#[tauri::command]
pub fn force_lock(
    app: AppHandle,
    state: State<'_, AutoLockState>,
    session: State<'_, NativeSessionState>,
) {
    session.clear();
    state.reset();
    app.emit("glyph:lock", ()).ok();
}

#[tauri::command]
pub fn get_pending_request(state: State<'_, DeepLinkState>) -> Option<String> {
    state.peek()
}

#[tauri::command]
pub fn clear_pending_request(state: State<'_, DeepLinkState>) {
    state.take();
}

#[tauri::command]
pub fn take_pending_pay(state: State<'_, DeepLinkState>) -> Option<String> {
    state.take_payment()
}

#[tauri::command]
pub fn copy_to_clipboard(
    text: String,
    clear_after_secs: u64,
    app: AppHandle,
    clip_state: State<'_, ClipboardState>,
) -> Result<(), String> {
    app.clipboard().write_text(&text).map_err(|e| e.to_string())?;
    clip_state.schedule_clear(clear_after_secs.min(MAX_CLIPBOARD_CLEAR_SECS));
    Ok(())
}

#[tauri::command]
pub fn clear_clipboard(app: AppHandle, clip_state: State<'_, ClipboardState>) {
    app.clipboard().write_text("").ok();
    clip_state.cancel_clear();
}

#[tauri::command]
pub fn lock_clipboard(app: AppHandle, clip_state: State<'_, ClipboardState>) {
    if clip_state.has_pending_clear() {
        app.clipboard().write_text("").ok();
        clip_state.cancel_clear();
    }
}

pub fn is_private_host(host: &str) -> bool {
    let h = host.trim_matches(|c| c == '[' || c == ']').to_ascii_lowercase();
    if h == "localhost" {
        return true;
    }

    if let Ok(ip) = h.parse::<IpAddr>() {
        return is_non_global_ip(ip);
    }

    false
}

fn is_non_global_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_unspecified()
        || ip.is_multicast()
        || a == 0
        || (a == 100 && (64..=127).contains(&b))
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113)
        || a >= 240
}

fn is_non_global_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_non_global_ipv4(ip),
        IpAddr::V6(ip) => ip
            .to_ipv4_mapped()
            .map(is_non_global_ipv4)
            .unwrap_or_else(|| {
                ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.is_multicast()
                || (ip.segments()[0] == 0x2001 && ip.segments()[1] == 0x0db8)
            }),
    }
}

async fn resolve_public_host(host: String, port: u16) -> Result<SocketAddr, String> {
    tokio::task::spawn_blocking(move || {
        let addrs = (host.as_str(), port)
            .to_socket_addrs()
            .map_err(|e| format!("failed to resolve callback host: {e}"))?;

        let mut first = None;
        for addr in addrs {
            if is_non_global_ip(addr.ip()) {
                return Err("callback URL must not resolve to a non-global address".into());
            }
            first.get_or_insert(addr);
        }
        first.ok_or_else(|| "callback URL host did not resolve to any addresses".into())
    })
    .await
    .map_err(|e| e.to_string())?
}

const MAX_CALLBACK_BODY: usize = 4 * 1024; // 4 KB

fn validate_callback_target(parsed: &url::Url) -> Result<(String, u16), String> {
    let host = parsed
        .host_str()
        .ok_or("callback URL has no host")?
        .to_string();

    if parsed.scheme() != "https" {
        return Err("callback URL must use HTTPS".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("callback URL must not include credentials".into());
    }
    if is_private_host(&host) {
        return Err("callback URL must not target a non-global address".into());
    }
    let port = parsed
        .port_or_known_default()
        .ok_or("callback URL has no usable port")?;

    Ok((host, port))
}

fn sanitize_reqwest_error(error: reqwest::Error) -> String {
    if let Some(status) = error.status() {
        return format!("callback server returned HTTP {}", status.as_u16());
    }

    if error.is_timeout() {
        return "callback request timed out".into();
    }

    if error.is_connect() {
        return "failed to connect to callback server".into();
    }

    "callback request failed".into()
}

#[tauri::command]
pub async fn post_callback(url: String, body: String) -> Result<(), String> {
    if body.len() > MAX_CALLBACK_BODY {
        return Err("callback body exceeds 4 KB limit".into());
    }

    let parsed = url::Url::parse(&url).map_err(|_| "invalid callback URL".to_string())?;
    let (host, port) = validate_callback_target(&parsed)?;
    let validated_addr = resolve_public_host(host.clone(), port).await?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .resolve(&host, validated_addr)
        .build()
        .map_err(|_| "failed to prepare callback request".to_string())?;

    client
        .post(parsed)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(sanitize_reqwest_error)?
        .error_for_status()
        .map_err(sanitize_reqwest_error)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_private_host, validate_callback_target};

    #[test]
    fn rejects_non_global_and_mapped_ip_literals() {
        for host in [
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "100.64.0.1",
            "192.0.2.1",
            "198.18.0.1",
            "203.0.113.1",
            "224.0.0.1",
            "[::1]",
            "[::ffff:127.0.0.1]",
            "[::ffff:10.0.0.1]",
            "[2001:db8::1]",
        ] {
            assert!(is_private_host(host), "expected {host} to be rejected");
        }
        assert!(!is_private_host("8.8.8.8"));
    }

    #[test]
    fn callback_target_rejects_embedded_credentials() {
        let url = url::Url::parse("https://token@8.8.8.8/callback").unwrap();
        assert_eq!(
            validate_callback_target(&url),
            Err("callback URL must not include credentials".into())
        );
    }
}
