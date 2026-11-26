//! URL, origin, and host validation for delivery destinations.

use url::Url;

use super::OFFICIAL_RELAY_ORIGIN;

pub(super) fn is_official_relay_callback(url: &Url) -> bool {
    if url.origin().ascii_serialization() != OFFICIAL_RELAY_ORIGIN
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return false;
    }

    let Some(path) = url.path().strip_prefix("/v2/callback/") else {
        return false;
    };
    let mut segments = path.split('/');
    let (Some(session), Some(callback_cap), None) =
        (segments.next(), segments.next(), segments.next())
    else {
        return false;
    };
    let is_base64url = |value: &str| {
        value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    };
    session.len() >= 22
        && session.len() <= 128
        && is_base64url(session)
        && callback_cap.starts_with("c_")
        && callback_cap.len() >= 24
        && callback_cap.len() <= 128
        && is_base64url(&callback_cap[2..])
}

pub(super) fn validate_delivery_url(
    url_str: &str,
    field: &str,
    claimed_origin: &str,
    allow_official_relay: bool,
) -> Result<(), String> {
    let url = Url::parse(url_str).map_err(|_| format!("invalid {field} URL"))?;
    let host = url.host_str().unwrap_or("");
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err(format!(
            "{field} must use HTTPS without embedded credentials"
        ));
    }
    if crate::commands::is_private_host(host) {
        return Err(format!("{field} must not target a non-global address"));
    }
    if url.origin().ascii_serialization() != claimed_origin
        && !(allow_official_relay && is_official_relay_callback(&url))
    {
        return Err(format!("{field} origin must match dapp.origin"));
    }
    Ok(())
}

pub(super) fn validate_dapp_origin(origin: &str) -> Result<String, String> {
    let parsed = Url::parse(origin).map_err(|_| format!("invalid dapp.origin: {origin}"))?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("dapp.origin must be a credential-free HTTPS origin".into());
    }

    Ok(parsed.origin().ascii_serialization())
}
