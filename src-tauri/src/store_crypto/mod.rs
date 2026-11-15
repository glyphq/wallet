//! Metadata-at-rest encryption commands.
//!
//! The on-disk key material is managed by `key_storage`; this module only
//! exposes the encrypt/decrypt commands and keeps the original
//! `store_crypto::*` paths stable for the invoke handler.

mod encryption;
mod key_storage;

use encryption::{decrypt_value, encrypt_value};
use tauri::command;

#[command]
pub async fn encrypt_store_value(value: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || encrypt_value(&value))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn decrypt_store_value(value: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || decrypt_value(&value))
        .await
        .map_err(|e| e.to_string())?
}
