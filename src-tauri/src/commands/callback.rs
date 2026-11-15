//! Outbound callback delivery for authorized deep-link requests.

use tauri::State;

use super::validation::{resolve_public_host, sanitize_reqwest_error, validate_callback_target};
use crate::deep_link::DeepLinkState;

const MAX_CALLBACK_BODY: usize = 4 * 1024; // 4 KB

#[tauri::command]
pub async fn post_callback(
    state: State<'_, DeepLinkState>,
    payload: String,
    url: String,
    body: String,
) -> Result<(), String> {
    if body.len() > MAX_CALLBACK_BODY {
        return Err("callback body exceeds 4 KB limit".into());
    }

    if !state.authorizes_callback_delivery(&payload) {
        return Err("callback is not authorized for this request".into());
    }
    let expected_url = crate::deep_link::callback_from_envelope_payload(&payload)?;
    if expected_url.as_deref() != Some(url.as_str()) {
        return Err("callback URL does not match the validated request".into());
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
