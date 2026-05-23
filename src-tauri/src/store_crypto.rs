use aes_gcm::aead::{Aead, OsRng, rand_core::RngCore};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use tauri::command;

const STORE_KEY_TARGET: &str = "sigil-store-key";
const STORE_VALUE_PREFIX: &str = "enc-v1:";

#[cfg(debug_assertions)]
fn dev_fallback_key_path() -> Result<std::path::PathBuf, String> {
    use std::path::PathBuf;

    #[cfg(target_os = "windows")]
    {
        let base = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| "APPDATA is not set".to_string())?;
        return Ok(base.join("Sigil").join("dev-store-key"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let base = std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))
            .ok_or_else(|| "HOME is not set".to_string())?;
        Ok(base.join("sigil").join("dev-store-key"))
    }
}

#[cfg(debug_assertions)]
fn load_dev_fallback_key() -> Result<Option<String>, String> {
    let path = dev_fallback_key_path()?;
    match std::fs::read_to_string(path) {
        Ok(value) => Ok(Some(value.trim().to_string())),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[cfg(debug_assertions)]
fn store_dev_fallback_key(secret: &str) -> Result<(), String> {
    let path = dev_fallback_key_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| "invalid dev fallback key path".to_string())?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    std::fs::write(&path, secret).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        let _ = std::fs::set_permissions(&path, perms);
    }

    Ok(())
}

#[cfg(target_os = "windows")]
mod secret_store {
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::Security::Credentials::{
        CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS, CRED_PERSIST_LOCAL_MACHINE,
        CRED_TYPE_GENERIC,
    };
    use windows::core::{PCWSTR, PWSTR};

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn store(target_name: &str, secret: &str) -> Result<(), String> {
        let target = to_wide(target_name);
        let mut blob = secret.as_bytes().to_vec();

        let cred = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target.as_ptr() as *mut u16),
            Comment: PWSTR::null(),
            LastWritten: FILETIME::default(),
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: PWSTR::null(),
            UserName: PWSTR::null(),
        };

        unsafe { CredWriteW(&cred, 0).map_err(|e| e.to_string()) }
    }

    pub fn load(target_name: &str) -> Result<String, String> {
        let target = to_wide(target_name);
        let mut pcred: *mut CREDENTIALW = std::ptr::null_mut();

        unsafe {
            windows::Win32::Security::Credentials::CredReadW(
                PCWSTR(target.as_ptr()),
                CRED_TYPE_GENERIC,
                0,
                &mut pcred,
            )
            .map_err(|e| format!("CredReadW: {e}"))?;

            let cred = &*pcred;
            let blob = std::slice::from_raw_parts(
                cred.CredentialBlob,
                cred.CredentialBlobSize as usize,
            );
            let result = std::str::from_utf8(blob)
                .map(|s| s.to_string())
                .map_err(|e| format!("utf8: {e}"));

            windows::Win32::Security::Credentials::CredFree(pcred as *const _);
            result
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod secret_store {
    use keyring::Entry;
    use keyring::Error;

    fn entry(target_name: &str) -> Result<Entry, String> {
        Entry::new("sigil-store", target_name).map_err(|e| e.to_string())
    }

    pub fn load_optional(target_name: &str) -> Result<Option<String>, String> {
        match entry(target_name)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(Error::NoEntry) => Ok(None),
            Err(err) => Err(err.to_string()),
        }
    }

    pub fn store(target_name: &str, secret: &str) -> Result<(), String> {
        entry(target_name)?
            .set_password(secret)
            .map_err(|e| e.to_string())
    }
}

fn get_or_create_store_key() -> Result<[u8; 32], String> {
    #[cfg(all(debug_assertions, not(target_os = "windows")))]
    if let Some(encoded) = load_dev_fallback_key()? {
        let decoded = URL_SAFE_NO_PAD
            .decode(encoded)
            .map_err(|e| format!("invalid dev metadata key: {e}"))?;
        return decoded
            .try_into()
            .map_err(|_| "invalid dev metadata key length".to_string());
    }

    #[cfg(target_os = "windows")]
    if let Ok(encoded) = secret_store::load(STORE_KEY_TARGET) {
        #[cfg(debug_assertions)]
        let _ = store_dev_fallback_key(&encoded);
        let decoded = URL_SAFE_NO_PAD
            .decode(encoded)
            .map_err(|e| format!("invalid stored metadata key: {e}"))?;
        return decoded
            .try_into()
            .map_err(|_| "invalid stored metadata key length".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    match secret_store::load_optional(STORE_KEY_TARGET) {
        Ok(Some(encoded)) => {
            #[cfg(debug_assertions)]
            let _ = store_dev_fallback_key(&encoded);
            let decoded = URL_SAFE_NO_PAD
                .decode(encoded)
                .map_err(|e| format!("invalid stored metadata key: {e}"))?;
            return decoded
                .try_into()
                .map_err(|_| "invalid stored metadata key length".to_string());
        }
        Ok(None) => {}
        Err(err) => {
            #[cfg(debug_assertions)]
            {
                if let Some(encoded) = load_dev_fallback_key()? {
                    let decoded = URL_SAFE_NO_PAD
                        .decode(encoded)
                        .map_err(|e| format!("invalid dev metadata key: {e}"))?;
                    return decoded
                        .try_into()
                        .map_err(|_| "invalid dev metadata key length".to_string());
                }
            }
            return Err(err);
        }
    }

    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    let encoded = URL_SAFE_NO_PAD.encode(key);
    if let Err(_err) = secret_store::store(STORE_KEY_TARGET, &encoded) {
        #[cfg(debug_assertions)]
        {
            store_dev_fallback_key(&encoded)?;
            return Ok(key);
        }

        #[cfg(not(debug_assertions))]
        {
            return Err(_err);
        }
    }
    Ok(key)
}

fn encrypt_value(value: &str) -> Result<String, String> {
    let key = get_or_create_store_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);

    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), value.as_bytes())
        .map_err(|_| "store encryption failed".to_string())?;

    let mut payload = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&ciphertext);

    Ok(format!("{STORE_VALUE_PREFIX}{}", URL_SAFE_NO_PAD.encode(payload)))
}

fn decrypt_value(value: &str) -> Result<String, String> {
    let Some(encoded) = value.strip_prefix(STORE_VALUE_PREFIX) else {
        return Ok(value.to_string());
    };

    let key = get_or_create_store_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
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
