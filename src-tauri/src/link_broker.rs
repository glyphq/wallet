use std::collections::HashSet;
use url::Url;

const MAX_URL_BYTES: usize = 12 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkKind {
    Request,
    Pay,
}

pub fn validate_launch_url(raw: &str) -> Result<LinkKind, String> {
    if raw.is_empty() || raw.len() > MAX_URL_BYTES {
        return Err("link length is outside the allowed range".into());
    }
    if raw.chars().any(|ch| ch.is_control() || ch.is_whitespace()) {
        return Err("link contains control or whitespace characters".into());
    }
    if raw.contains(['"', '\'', '\\', '|']) {
        return Err("link contains unsafe command-line characters".into());
    }

    let url = Url::parse(raw).map_err(|_| "link is not a valid URL".to_string())?;
    if url.scheme() != "glyph"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return Err("link authority is not allowed".into());
    }

    match (url.host_str(), url.path()) {
        (Some("v2"), "/request") => {
            validate_query_keys(&url, &["d"], &["d"])?;
            Ok(LinkKind::Request)
        }
        (Some("pay"), "" | "/") => {
            validate_query_keys(&url, &["to", "amount", "label"], &["to"])?;
            Ok(LinkKind::Pay)
        }
        _ => Err("link route is not allowed".into()),
    }
}

fn validate_query_keys(url: &Url, allowed: &[&str], required: &[&str]) -> Result<(), String> {
    let mut seen = HashSet::new();
    for (key, value) in url.query_pairs() {
        if !allowed.contains(&key.as_ref()) {
            return Err(format!("query parameter '{key}' is not allowed"));
        }
        if !seen.insert(key.into_owned()) {
            return Err("duplicate query parameters are not allowed".into());
        }
        if value.is_empty() {
            return Err("empty query parameters are not allowed".into());
        }
        if value
            .chars()
            .any(|ch| ch.is_control() || matches!(ch, '"' | '\'' | '\\'))
        {
            return Err("query parameter contains unsafe characters".into());
        }
    }
    if required.iter().any(|key| !seen.contains(*key)) {
        return Err("a required query parameter is missing".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate_launch_url, LinkKind};

    #[test]
    fn accepts_only_the_two_public_routes() {
        assert_eq!(
            validate_launch_url("glyph://v2/request?d=YWJjZA"),
            Ok(LinkKind::Request)
        );
        assert_eq!(
            validate_launch_url(
                "glyph://pay?to=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
            ),
            Ok(LinkKind::Pay)
        );
    }

    #[test]
    fn rejects_command_line_and_route_injection() {
        let rejected = [
            "glyph://path/to/bash&MaliciousCommand",
            "glyph://v2/request?d=abc&cmd=calc.exe",
            "glyph://v2/request?d=abc%22%20--inspect",
            "glyph://v2/request?d=abc\\--inspect",
            "glyph://v2/request?d=abc\" --inspect",
            "glyph://v1/request?d=abc|glyph://pay?to=def",
            "glyph://user@v1/request?d=abc",
            "glyph://v1:80/request?d=abc",
            "glyph://v2/request?d=abc#fragment",
            "glyph://v2/request?d=abc&d=def",
            "glyph://pay/../../bin/bash?to=abc",
        ];

        for url in rejected {
            assert!(validate_launch_url(url).is_err(), "accepted {url}");
        }
    }

    #[test]
    fn rejects_split_or_non_url_input() {
        for value in ["", "--inspect", "glyph://v2/request d=abc", "\nglyph://v2/request?d=abc"] {
            assert!(validate_launch_url(value).is_err(), "accepted {value:?}");
        }
    }
}
