//! Tauri commands for creating, unlocking and editing encrypted vaults.

use serde::Serialize;
use tauri::{command, State};

use super::crypto::{decrypt_vault_data, encrypt_vault_data, VaultData};
use crate::session_crypto;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionWalletMetadata {
    pub(super) public_key: Vec<u8>,
    pub(super) identity: String,
}

pub(super) fn session_metadata(seeds: &[String]) -> Result<Vec<SessionWalletMetadata>, String> {
    seeds
        .iter()
        .map(|seed| {
            let public_key = crate::qubic_native::public_key_from_seed(seed)?;
            let identity = crate::qubic_native::public_key_to_identity(&public_key)?;
            Ok(SessionWalletMetadata {
                public_key: public_key.to_vec(),
                identity,
            })
        })
        .collect()
}

#[command]
pub async fn encrypt_vault(password: String, seeds: Vec<String>) -> Result<VaultData, String> {
    tokio::task::spawn_blocking(move || encrypt_vault_data(&password, &seeds))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn unlock_vault_session(
    vault_data: VaultData,
    password: String,
    session: State<'_, session_crypto::NativeSessionState>,
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
) -> Result<Vec<SessionWalletMetadata>, String> {
    let (seeds, metadata) = tokio::task::spawn_blocking(move || {
        let seeds = decrypt_vault_data(&vault_data, &password)?;
        session_crypto::validate_session_seeds(&seeds)?;
        let metadata = session_metadata(&seeds)?;
        Ok::<_, String>((seeds, metadata))
    })
    .await
    .map_err(|e| e.to_string())??;
    authorization_state.clear_signing_authorizations();
    session.replace_seeds(seeds);
    Ok(metadata)
}

#[command]
pub async fn verify_vault_password(vault_data: VaultData, password: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let seeds = decrypt_vault_data(&vault_data, &password)?;
        session_crypto::validate_session_seeds(&seeds)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn add_seed_to_vault(
    vault_data: VaultData,
    password: String,
    seed: String,
) -> Result<VaultData, String> {
    tokio::task::spawn_blocking(move || {
        let mut seeds = decrypt_vault_data(&vault_data, &password)?;
        seeds.push(seed);
        session_crypto::validate_session_seeds(&seeds)?;
        encrypt_vault_data(&password, &seeds)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn remove_seed_from_vault(
    vault_data: VaultData,
    password: String,
    index: usize,
) -> Result<VaultData, String> {
    tokio::task::spawn_blocking(move || {
        let mut seeds = decrypt_vault_data(&vault_data, &password)?;
        if index >= seeds.len() || seeds.len() <= 1 {
            return Err("vault must retain at least one account".to_string());
        }
        seeds.remove(index);
        encrypt_vault_data(&password, &seeds)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn select_vault_accounts(
    vault_data: VaultData,
    password: String,
    indices: Vec<usize>,
) -> Result<VaultData, String> {
    tokio::task::spawn_blocking(move || {
        if indices.is_empty() || indices.len() > 16 {
            return Err("select between 1 and 16 vault accounts".to_string());
        }
        let seeds = decrypt_vault_data(&vault_data, &password)?;
        let mut selected = Vec::with_capacity(indices.len());
        for index in indices {
            let seed = seeds
                .get(index)
                .ok_or_else(|| "selected account index is outside this vault".to_string())?;
            selected.push(seed.clone());
        }
        session_crypto::validate_session_seeds(&selected)?;
        encrypt_vault_data(&password, &selected)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn rotate_vault_password(
    vault_data: VaultData,
    old_password: String,
    new_password: String,
) -> Result<VaultData, String> {
    tokio::task::spawn_blocking(move || {
        let seeds = decrypt_vault_data(&vault_data, &old_password)?;
        session_crypto::validate_session_seeds(&seeds)?;
        encrypt_vault_data(&new_password, &seeds)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn reveal_vault_seed(
    vault_data: VaultData,
    password: String,
    account_index: usize,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let seeds = decrypt_vault_data(&vault_data, &password)?;
        seeds
            .get(account_index)
            .cloned()
            .ok_or_else(|| "account index is outside this vault".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
