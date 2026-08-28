use std::time::Duration;

use reqwest::Method;
use serde::Serialize;

const CORE_LITE_ORIGIN_PREFIX: &str = "http://127.0.0.1:41841/";
const LOCAL_NETWORK_MANIFEST_URL: &str = "http://127.0.0.1:41842/network-manifest.json";
const MAX_REQUEST_BODY_BYTES: usize = 1024 * 1024;
const MAX_RESPONSE_BODY_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRpcResponse {
    status: u16,
    body: String,
    content_type: Option<String>,
}

fn is_identity(segment: &str) -> bool {
    segment.len() == 60 && segment.bytes().all(|byte| byte.is_ascii_alphabetic())
}

fn is_index(segment: &str) -> bool {
    !segment.is_empty() && segment.bytes().all(|byte| byte.is_ascii_digit())
}

fn is_allowed_get_path(path: &str) -> bool {
    if matches!(
        path,
        "/live/v1/tick-info"
            | "/live/v1/ipos/active"
            | "/live/v1/assets/issuances"
            | "/live/v1/assets/ownerships"
            | "/live/v1/assets/possessions"
            | "/query/v1/getLastProcessedTick"
            | "/query/v1/getProcessedTickIntervals"
    ) {
        return true;
    }

    let segments: Vec<_> = path.trim_start_matches('/').split('/').collect();
    match segments.as_slice() {
        ["live", "v1", "balances", identity] => is_identity(identity),
        ["live", "v1", "assets", first, second] => {
            (is_identity(first) && matches!(*second, "issued" | "owned" | "possessed"))
                || (matches!(*first, "issuances" | "ownerships" | "possessions")
                    && is_index(second))
        }
        _ => false,
    }
}

fn is_allowed_post_path(path: &str) -> bool {
    matches!(
        path,
        "/live/v1/broadcast-transaction"
            | "/live/v1/querySmartContract"
            | "/query/v1/getComputorListsForEpoch"
            | "/query/v1/getTickData"
            | "/query/v1/getTransactionByHash"
            | "/query/v1/getTransactionsForIdentity"
            | "/query/v1/getTransactionsForTick"
            | "/query/v1/getEventLogs"
    )
}

fn validate_local_rpc_request(
    raw_url: &str,
    raw_method: &str,
    body: Option<&str>,
) -> Result<(url::Url, Method), String> {
    // Check the raw authority before URL parsing so alternate numeric, encoded,
    // user-info, and case variants cannot canonicalize into the allowed origin.
    if !raw_url.starts_with(CORE_LITE_ORIGIN_PREFIX) {
        return Err("local RPC URL must use the exact approved loopback origin".into());
    }

    let parsed = url::Url::parse(raw_url).map_err(|_| "invalid local RPC URL".to_string())?;
    if parsed.scheme() != "http"
        || parsed.host_str() != Some("127.0.0.1")
        || parsed.port() != Some(41841)
    {
        return Err("local RPC URL must use the exact approved loopback origin".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("local RPC URL must not include credentials".into());
    }
    if parsed.fragment().is_some() {
        return Err("local RPC URL must not include a fragment".into());
    }

    let method = Method::from_bytes(raw_method.as_bytes())
        .map_err(|_| "invalid local RPC method".to_string())?;
    let path_allowed = match method {
        Method::GET => is_allowed_get_path(parsed.path()),
        Method::POST => is_allowed_post_path(parsed.path()),
        _ => false,
    };
    if !path_allowed {
        return Err("local RPC method or path is not allowed".into());
    }

    if parsed.query().is_some()
        && !matches!(
            parsed.path(),
            "/live/v1/assets/issuances"
                | "/live/v1/assets/ownerships"
                | "/live/v1/assets/possessions"
        )
    {
        return Err("local RPC query parameters are not allowed for this path".into());
    }

    let body_len = body.map(str::len).unwrap_or_default();
    if body_len > MAX_REQUEST_BODY_BYTES {
        return Err("local RPC request body exceeds 1 MiB limit".into());
    }
    if method == Method::GET && body_len != 0 {
        return Err("local RPC GET requests must not include a body".into());
    }

    Ok((parsed, method))
}

fn validate_local_manifest_request(
    raw_url: &str,
    raw_method: &str,
    body: Option<&str>,
) -> Result<(url::Url, Method), String> {
    if raw_url != LOCAL_NETWORK_MANIFEST_URL {
        return Err("local network manifest URL is not allowed".into());
    }
    if raw_method != "GET" {
        return Err("local network manifest method must be GET".into());
    }
    if body.is_some() {
        return Err("local network manifest request must not include a body".into());
    }

    let parsed = url::Url::parse(raw_url)
        .map_err(|_| "invalid local network manifest URL".to_string())?;
    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("local network manifest URL must not include a query or fragment".into());
    }
    Ok((parsed, Method::GET))
}

fn sanitize_request_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        return "local RPC request timed out".into();
    }
    if error.is_connect() {
        return "failed to connect to local core-lite".into();
    }
    "local RPC request failed".into()
}

fn append_bounded(buffer: &mut Vec<u8>, chunk: &[u8], maximum: usize) -> Result<(), String> {
    let next_length = buffer
        .len()
        .checked_add(chunk.len())
        .ok_or_else(|| "local RPC response exceeds 16 MiB limit".to_string())?;
    if next_length > maximum {
        return Err("local RPC response exceeds 16 MiB limit".into());
    }
    buffer.extend_from_slice(chunk);
    Ok(())
}

async fn execute_local_request(
    url: url::Url,
    method: Method,
    body: Option<String>,
) -> Result<LocalRpcResponse, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .build()
        .map_err(|_| "failed to prepare local RPC request".to_string())?;

    let mut request = client
        .request(method, url)
        .header(reqwest::header::ACCEPT, "application/json");
    if let Some(body) = body {
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body);
    }

    let mut response = request.send().await.map_err(sanitize_request_error)?;
    if response.status().is_redirection() {
        return Err("local RPC redirects are not allowed".into());
    }

    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BODY_BYTES as u64)
    {
        return Err("local RPC response exceeds 16 MiB limit".into());
    }
    let capacity = response
        .content_length()
        .unwrap_or_default()
        .min(MAX_RESPONSE_BODY_BYTES as u64) as usize;
    let mut bytes = Vec::with_capacity(capacity);
    while let Some(chunk) = response.chunk().await.map_err(sanitize_request_error)? {
        append_bounded(&mut bytes, &chunk, MAX_RESPONSE_BODY_BYTES)?;
    }
    let body = String::from_utf8(bytes)
        .map_err(|_| "local RPC response was not valid UTF-8".to_string())?;

    Ok(LocalRpcResponse {
        status: status.as_u16(),
        body,
        content_type,
    })
}

#[tauri::command]
pub async fn local_rpc_request(
    url: String,
    method: String,
    body: Option<String>,
) -> Result<LocalRpcResponse, String> {
    let (url, method) = validate_local_rpc_request(&url, &method, body.as_deref())?;
    execute_local_request(url, method, body).await
}

#[tauri::command]
pub async fn fetch_local_network_manifest() -> Result<LocalRpcResponse, String> {
    let (url, method) =
        validate_local_manifest_request(LOCAL_NETWORK_MANIFEST_URL, "GET", None)?;
    execute_local_request(url, method, None).await
}

#[cfg(test)]
mod tests {
    use super::{
        append_bounded, validate_local_manifest_request, validate_local_rpc_request,
        LOCAL_NETWORK_MANIFEST_URL, MAX_REQUEST_BODY_BYTES,
    };

    const IDENTITY: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    fn valid(url: &str, method: &str) -> bool {
        validate_local_rpc_request(url, method, None).is_ok()
    }

    #[test]
    fn accepts_only_documented_rpc_methods_and_paths() {
        for (method, path) in [
            ("GET", "/live/v1/tick-info"),
            ("GET", "/query/v1/getLastProcessedTick"),
            ("GET", "/query/v1/getProcessedTickIntervals"),
            ("POST", "/live/v1/broadcast-transaction"),
            ("POST", "/live/v1/querySmartContract"),
            ("POST", "/query/v1/getTickData"),
            ("POST", "/query/v1/getTransactionByHash"),
            ("POST", "/query/v1/getTransactionsForIdentity"),
            ("POST", "/query/v1/getEventLogs"),
        ] {
            assert!(valid(&format!("http://127.0.0.1:41841{path}"), method));
        }

        assert!(valid(
            &format!("http://127.0.0.1:41841/live/v1/balances/{IDENTITY}"),
            "GET"
        ));
        assert!(valid(
            &format!("http://127.0.0.1:41841/live/v1/assets/{IDENTITY}/owned"),
            "GET"
        ));
        assert!(valid(
            "http://127.0.0.1:41841/live/v1/assets/ownerships?assetName=QX",
            "GET"
        ));
    }

    #[test]
    fn rejects_ssrf_origins_credentials_ports_and_protocols() {
        for url in [
            "https://127.0.0.1:41841/live/v1/tick-info",
            "http://localhost:41841/live/v1/tick-info",
            "http://[::1]:41841/live/v1/tick-info",
            "http://127.0.0.2:41841/live/v1/tick-info",
            "http://127.0.0.1/live/v1/tick-info",
            "http://127.0.0.1:80/live/v1/tick-info",
            "http://127.0.0.1:41840/live/v1/tick-info",
            "http://10.0.0.1:41841/live/v1/tick-info",
            "http://172.16.0.1:41841/live/v1/tick-info",
            "http://192.168.1.1:41841/live/v1/tick-info",
            "http://169.254.169.254:41841/live/v1/tick-info",
            "http://8.8.8.8:41841/live/v1/tick-info",
            "http://2130706433:41841/live/v1/tick-info",
            "http://0177.0.0.1:41841/live/v1/tick-info",
            "http://user@127.0.0.1:41841/live/v1/tick-info",
            "http://user:pass@127.0.0.1:41841/live/v1/tick-info",
            "file:///live/v1/tick-info",
            "ftp://127.0.0.1:41841/live/v1/tick-info",
        ] {
            assert!(!valid(url, "GET"), "expected SSRF target to be rejected: {url}");
        }
    }

    #[test]
    fn rejects_unknown_dangerous_or_ambiguous_paths() {
        for (method, path) in [
            ("GET", "/"),
            ("GET", "/explorer"),
            ("GET", "/live/v1/dev/funded-seed"),
            ("GET", "/live/v1/debug-trace"),
            ("GET", "/v1/latest-stats"),
            ("GET", "/live/v1/tick-info/extra"),
            ("GET", "/live/v1/tick-info?redirect=http://169.254.169.254"),
            ("GET", "/live/v1/%2e%2e/dev/funded-seed"),
            ("POST", "/live/v1/tick-info"),
            ("DELETE", "/query/v1/getTickData"),
        ] {
            assert!(!valid(&format!("http://127.0.0.1:41841{path}"), method));
        }
    }

    #[test]
    fn rejects_fragments_invalid_dynamic_segments_and_oversized_bodies() {
        assert!(!valid(
            "http://127.0.0.1:41841/live/v1/tick-info#fragment",
            "GET"
        ));
        assert!(!valid(
            "http://127.0.0.1:41841/live/v1/balances/not-an-identity",
            "GET"
        ));
        assert!(!valid(
            "http://127.0.0.1:41841/live/v1/assets/ownerships/not-a-number",
            "GET"
        ));

        let oversized = "x".repeat(MAX_REQUEST_BODY_BYTES + 1);
        assert!(validate_local_rpc_request(
            "http://127.0.0.1:41841/query/v1/getTickData",
            "POST",
            Some(&oversized),
        )
        .is_err());
        assert!(validate_local_rpc_request(
            "http://127.0.0.1:41841/live/v1/tick-info",
            "GET",
            Some("{}"),
        )
        .is_err());
    }

    #[test]
    fn bounds_streamed_response_chunks_before_appending() {
        let mut response = vec![1, 2, 3];
        append_bounded(&mut response, &[4, 5], 5).unwrap();
        assert_eq!(response, vec![1, 2, 3, 4, 5]);

        let error = append_bounded(&mut response, &[6], 5).unwrap_err();
        assert_eq!(error, "local RPC response exceeds 16 MiB limit");
        assert_eq!(response, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn manifest_policy_allows_one_exact_bodyless_get_only() {
        assert!(validate_local_manifest_request(LOCAL_NETWORK_MANIFEST_URL, "GET", None).is_ok());
        assert!(
            validate_local_manifest_request(LOCAL_NETWORK_MANIFEST_URL, "GET", Some(""))
                .is_err()
        );

        for url in [
            "http://127.0.0.1:41842/",
            "http://127.0.0.1:41842/network-manifest.json?x=1",
            "http://127.0.0.1:41842/network-manifest.json#fragment",
            "http://127.0.0.1:41842/other.json",
            "http://localhost:41842/network-manifest.json",
            "http://127.0.0.1:41841/network-manifest.json",
            "http://10.0.0.1:41842/network-manifest.json",
            "https://127.0.0.1:41842/network-manifest.json",
            "http://user@127.0.0.1:41842/network-manifest.json",
        ] {
            assert!(
                validate_local_manifest_request(url, "GET", None).is_err(),
                "expected manifest target to be rejected: {url}"
            );
        }
        assert!(validate_local_manifest_request(LOCAL_NETWORK_MANIFEST_URL, "POST", None).is_err());
        assert!(
            validate_local_manifest_request(LOCAL_NETWORK_MANIFEST_URL, "GET", Some("{}"))
                .is_err()
        );
    }
}
