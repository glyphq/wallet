use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use pbkdf2::pbkdf2_hmac_array;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tauri::{command, State};

const VAULT_VERSION: u32 = 1;
const PBKDF2_ITERATIONS: u32 = 600_000;
const MIN_PBKDF2_ITERATIONS: u32 = 100_000;
const MAX_PBKDF2_ITERATIONS: u32 = 2_000_000;
const SALT_BYTES: usize = 32;
const IV_BYTES: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultData {
    pub version: u32,
    pub iterations: u32,
    pub salt: String,
    pub iv: String,
    pub ciphertext: String,
}

#[derive(Serialize, Deserialize)]
struct VaultPayload {
    seeds: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionWalletMetadata {
    public_key: Vec<u8>,
    identity: String,
}

fn derive_key(password: &str, salt: &[u8], iterations: u32) -> [u8; 32] {
    pbkdf2_hmac_array::<Sha256, 32>(password.as_bytes(), salt, iterations)
}

pub fn encrypt_vault_data(password: &str, seeds: &[String]) -> Result<VaultData, String> {
    let salt_key = Aes256Gcm::generate_key(&mut OsRng);
    let salt = salt_key.as_slice(); // full 32 bytes (SALT_BYTES)
    let iv = Aes256Gcm::generate_nonce(&mut OsRng);

    let key = derive_key(password, salt, PBKDF2_ITERATIONS);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let plaintext = serde_json::to_vec(&VaultPayload {
        seeds: seeds.to_vec(),
    })
    .map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(&iv, plaintext.as_ref())
        .map_err(|_| "vault encryption failed".to_string())?;

    Ok(VaultData {
        version: VAULT_VERSION,
        iterations: PBKDF2_ITERATIONS,
        salt: hex::encode(salt),
        iv: hex::encode(iv.as_slice()),
        ciphertext: hex::encode(ciphertext),
    })
}

pub fn decrypt_vault_data(vault_data: &VaultData, password: &str) -> Result<Vec<String>, String> {
    if vault_data.version != VAULT_VERSION {
        return Err(format!("unsupported version {}", vault_data.version));
    }

    let salt = hex::decode(&vault_data.salt).map_err(|_| "malformed salt".to_string())?;
    let iv = hex::decode(&vault_data.iv).map_err(|_| "malformed iv".to_string())?;
    let ciphertext =
        hex::decode(&vault_data.ciphertext).map_err(|_| "malformed ciphertext".to_string())?;
    if salt.len() != 16 && salt.len() != SALT_BYTES {
        return Err("malformed salt".to_string());
    }
    if iv.len() != IV_BYTES {
        return Err("malformed iv".to_string());
    }
    if vault_data.iterations < MIN_PBKDF2_ITERATIONS {
        return Err(format!(
            "vault iteration count too low: {}",
            vault_data.iterations
        ));
    }
    if vault_data.iterations > MAX_PBKDF2_ITERATIONS {
        return Err("vault iteration count exceeds the supported maximum".to_string());
    }

    let key = derive_key(password, &salt, vault_data.iterations);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| "vault decryption failed".to_string())?;

    let payload: VaultPayload =
        serde_json::from_slice(&plaintext).map_err(|_| "vault payload is invalid".to_string())?;
    Ok(payload.seeds)
}

fn session_metadata(seeds: &[String]) -> Result<Vec<SessionWalletMetadata>, String> {
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
    session: State<'_, crate::session_crypto::NativeSessionState>,
    authorization_state: State<'_, crate::deep_link::DeepLinkState>,
) -> Result<Vec<SessionWalletMetadata>, String> {
    let (seeds, metadata) = tokio::task::spawn_blocking(move || {
        let seeds = decrypt_vault_data(&vault_data, &password)?;
        crate::session_crypto::validate_session_seeds(&seeds)?;
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
        crate::session_crypto::validate_session_seeds(&seeds)
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
        crate::session_crypto::validate_session_seeds(&seeds)?;
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
        crate::session_crypto::validate_session_seeds(&selected)?;
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
        crate::session_crypto::validate_session_seeds(&seeds)?;
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

#[cfg(test)]
mod tests {
    use super::{decrypt_vault_data, session_metadata, VaultData, MAX_PBKDF2_ITERATIONS};

    #[test]
    fn rejects_excessive_iteration_counts_before_derivation() {
        let vault = VaultData {
            version: 1,
            iterations: MAX_PBKDF2_ITERATIONS + 1,
            salt: "00".repeat(32),
            iv: "00".repeat(12),
            ciphertext: "00".repeat(16),
        };
        let non_secret_test_input = std::process::id().to_string();
        assert_eq!(
            decrypt_vault_data(&vault, &non_secret_test_input).unwrap_err(),
            "vault iteration count exceeds the supported maximum"
        );
    }

    #[test]
    fn unlock_metadata_contains_only_public_account_data() {
        let metadata = session_metadata(&["a".repeat(55)]).unwrap();

        assert_eq!(metadata.len(), 1);
        assert_eq!(metadata[0].public_key.len(), 32);
        assert_eq!(metadata[0].identity.len(), 60);
        let serialized = serde_json::to_string(&metadata).unwrap();
        assert!(!serialized.contains(&"a".repeat(55)));
    }
}
