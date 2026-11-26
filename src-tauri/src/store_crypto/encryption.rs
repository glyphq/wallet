//! AES-256-GCM envelope used for persisted metadata values.

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

use super::key_storage::get_or_create_store_key;

const STORE_VALUE_PREFIX: &str = "enc-v1:";

pub(super) fn encrypt_value(value: &str) -> Result<String, String> {
    let key = get_or_create_store_key()?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, value.as_bytes())
        .map_err(|_| "store encryption failed".to_string())?;

    let mut payload = Vec::with_capacity(nonce.len() + ciphertext.len());
    payload.extend_from_slice(nonce.as_slice());
    payload.extend_from_slice(&ciphertext);

    Ok(format!(
        "{STORE_VALUE_PREFIX}{}",
        URL_SAFE_NO_PAD.encode(payload)
    ))
}

pub(super) fn decrypt_value(value: &str) -> Result<String, String> {
    let Some(encoded) = value.strip_prefix(STORE_VALUE_PREFIX) else {
        return Ok(value.to_string());
    };

    let key = get_or_create_store_key()?;
    let cipher = Aes256Gcm::new(&key);
    let payload = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|e| format!("invalid encrypted metadata payload: {e}"))?;
    if payload.len() < 13 {
        return Err("encrypted metadata payload is too short".into());
    }
    let (nonce_bytes, ciphertext) = payload.split_at(12);
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "store decryption failed".to_string())?;
    String::from_utf8(plaintext).map_err(|e| format!("store plaintext is not utf-8: {e}"))
}
