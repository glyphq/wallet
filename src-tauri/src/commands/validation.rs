//! Shared validation helpers for outbound callback delivery.
//!
//! Callback URLs come from untrusted deep links, so every request target is
//! checked for scheme, credentials, and non-global address ranges before the
//! host is resolved and pinned.

use std::net::{IpAddr, Ipv4Addr, SocketAddr, ToSocketAddrs};

pub fn is_private_host(host: &str) -> bool {
    let h = host
        .trim_matches(|c| c == '[' || c == ']')
        .to_ascii_lowercase();
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

pub(super) async fn resolve_public_host(host: String, port: u16) -> Result<SocketAddr, String> {
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

pub(super) fn validate_callback_target(parsed: &url::Url) -> Result<(String, u16), String> {
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

pub(super) fn sanitize_reqwest_error(error: reqwest::Error) -> String {
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
