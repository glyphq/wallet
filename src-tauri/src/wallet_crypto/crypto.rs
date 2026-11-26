//! AES-256-GCM wallet envelope with PBKDF2-SHA256 key derivation.
//!
//! The wallet is a versioned JSON envelope: `salt`, `iv` and `ciphertext` are
//! hex encoded, and the plaintext is the JSON seed list.

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use pbkdf2::pbkdf2_hmac_array;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

const WALLET_VERSION: u32 = 1;
const PBKDF2_ITERATIONS: u32 = 600_000;
const MIN_PBKDF2_ITERATIONS: u32 = 100_000;
pub(super) const MAX_PBKDF2_ITERATIONS: u32 = 2_000_000;
const SALT_BYTES: usize = 32;
const IV_BYTES: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletData {
    pub version: u32,
    pub iterations: u32,
    pub salt: String,
    pub iv: String,
    pub ciphertext: String,
}

#[derive(Serialize, Deserialize)]
struct WalletPayload {
    seeds: Vec<String>,
}

fn derive_key(password: &str, salt: &[u8], iterations: u32) -> [u8; 32] {
    pbkdf2_hmac_array::<Sha256, 32>(password.as_bytes(), salt, iterations)
}

pub fn encrypt_wallet_data(password: &str, seeds: &[String]) -> Result<WalletData, String> {
    let salt_key = Aes256Gcm::generate_key(&mut OsRng);
    let salt = salt_key.as_slice(); // full 32 bytes (SALT_BYTES)
    let iv = Aes256Gcm::generate_nonce(&mut OsRng);

    let key = derive_key(password, salt, PBKDF2_ITERATIONS);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let plaintext = serde_json::to_vec(&WalletPayload {
        seeds: seeds.to_vec(),
    })
    .map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(&iv, plaintext.as_ref())
        .map_err(|_| "wallet encryption failed".to_string())?;

    Ok(WalletData {
        version: WALLET_VERSION,
        iterations: PBKDF2_ITERATIONS,
        salt: hex::encode(salt),
        iv: hex::encode(iv.as_slice()),
        ciphertext: hex::encode(ciphertext),
    })
}

pub fn decrypt_wallet_data(
    wallet_data: &WalletData,
    password: &str,
) -> Result<Vec<String>, String> {
    if wallet_data.version != WALLET_VERSION {
        return Err(format!("unsupported version {}", wallet_data.version));
    }

    let salt = hex::decode(&wallet_data.salt).map_err(|_| "malformed salt".to_string())?;
    let iv = hex::decode(&wallet_data.iv).map_err(|_| "malformed iv".to_string())?;
    let ciphertext =
        hex::decode(&wallet_data.ciphertext).map_err(|_| "malformed ciphertext".to_string())?;
    if salt.len() != 16 && salt.len() != SALT_BYTES {
        return Err("malformed salt".to_string());
    }
    if iv.len() != IV_BYTES {
        return Err("malformed iv".to_string());
    }
    if wallet_data.iterations < MIN_PBKDF2_ITERATIONS {
        return Err(format!(
            "wallet iteration count too low: {}",
            wallet_data.iterations
        ));
    }
    if wallet_data.iterations > MAX_PBKDF2_ITERATIONS {
        return Err("wallet iteration count exceeds the supported maximum".to_string());
    }

    let key = derive_key(password, &salt, wallet_data.iterations);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| "wallet decryption failed".to_string())?;

    let payload: WalletPayload =
        serde_json::from_slice(&plaintext).map_err(|_| "wallet payload is invalid".to_string())?;
    Ok(payload.seeds)
}
