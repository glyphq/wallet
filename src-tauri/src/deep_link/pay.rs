//! Parsing for `glyph://pay` links.

use url::Url;

pub(super) struct PayRequest {
    pub(super) to: String,
    pub(super) amount: Option<String>,
    pub(super) label: Option<String>,
}

pub(super) fn validate_pay(uri_str: &str) -> Result<PayRequest, String> {
    let url = Url::parse(uri_str).map_err(|e| format!("invalid URI: {e}"))?;
    if crate::link_broker::validate_launch_url(uri_str) != Ok(crate::link_broker::LinkKind::Pay) {
        return Err("not a glyph://pay URI".into());
    }

    let mut to: Option<String> = None;
    let mut amount: Option<String> = None;
    let mut label: Option<String> = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "to" if to.is_none() => to = Some(v.into_owned()),
            "amount" if amount.is_none() => amount = Some(v.into_owned()),
            "label" if label.is_none() => label = Some(v.into_owned().chars().take(200).collect()),
            "to" | "amount" | "label" => {
                return Err("duplicate query parameters are not allowed".into())
            }
            _ => {}
        }
    }

    let to = to.ok_or("missing 'to' parameter")?;
    if crate::qubic_native::identity_to_public_key(&to).is_err() {
        return Err(format!(
            "invalid identity in 'to': {}",
            &to[..to.len().min(8)]
        ));
    }
    if let Some(ref a) = amount {
        let n: i64 = a.parse().map_err(|_| "amount is not a valid integer")?;
        if n <= 0 {
            return Err("amount must be positive".into());
        }
    }

    Ok(PayRequest { to, amount, label })
}
