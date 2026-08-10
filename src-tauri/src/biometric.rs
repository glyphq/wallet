use tauri::{command, State};
use crate::session_crypto::NativeSessionState;
use crate::vault_crypto::VaultData;

fn validate_vault_id(vault_id: &str) -> Result<(), String> {
    let is_uuid = vault_id.len() == 36
        && vault_id
            .chars()
            .enumerate()
            .all(|(idx, ch)| match idx {
                8 | 13 | 18 | 23 => ch == '-',
                _ => ch.is_ascii_hexdigit(),
            });

    if is_uuid {
        Ok(())
    } else {
        Err("invalid vault id".into())
    }
}

// ── Credential storage ─────────────────────────────────────────────────────
//
// On Windows the `keyring` crate writes to a session-scoped store that doesn't
// survive app restart. We use CredWriteW/CredReadW directly with
// CRED_PERSIST_LOCAL_MACHINE to guarantee persistence.

#[cfg(target_os = "windows")]
#[allow(dead_code)]
mod cred_store {
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
        CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };
    use windows::core::{PCWSTR, PWSTR};

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn target(vault_id: &str) -> Vec<u16> {
        to_wide(&format!("glyph-vault/{}", vault_id))
    }

    pub fn store(vault_id: &str, password: &str) -> Result<(), String> {
        let target = target(vault_id);
        let mut blob = password.as_bytes().to_vec();

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

    pub fn load(vault_id: &str) -> Result<String, String> {
        let target = target(vault_id);
        let mut pcred: *mut CREDENTIALW = std::ptr::null_mut();

        unsafe {
            CredReadW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, 0, &mut pcred)
                .map_err(|e| format!("CredReadW: {e}"))?;

            let cred = &*pcred;
            let blob = std::slice::from_raw_parts(
                cred.CredentialBlob,
                cred.CredentialBlobSize as usize,
            );
            let result = std::str::from_utf8(blob)
                .map(|s| s.to_string())
                .map_err(|e| format!("utf8: {e}"));

            CredFree(pcred as *const _);
            result
        }
    }

    pub fn delete(vault_id: &str) -> Result<(), String> {
        let target = target(vault_id);
        unsafe {
            CredDeleteW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, 0)
                .map_err(|e| e.to_string())
        }
    }
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
mod cred_store {
    use keyring::Entry;

    fn entry(vault_id: &str) -> Result<Entry, String> {
        Entry::new("glyph-bio", vault_id).map_err(|e| e.to_string())
    }

    /// Probes the underlying secret-service backend with a real round-trip.
    /// Returns false on any platform that has no working secret-service daemon
    /// (no gnome-keyring, no kwallet, mock backend, etc.).
    pub fn available() -> bool {
        let Ok(e) = entry("__glyph_probe__") else { return false; };
        if e.set_password("probe").is_err() { return false; }
        let ok = e.get_password().is_ok();
        let _ = e.delete_credential();
        ok
    }

    pub fn store(vault_id: &str, password: &str) -> Result<(), String> {
        let e = entry(vault_id)?;
        e.set_password(password).map_err(|e| e.to_string())?;
        e.get_password()
            .map_err(|e| format!("stored but unreadable: {e}"))?;
        Ok(())
    }

    pub fn load(vault_id: &str) -> Result<String, String> {
        entry(vault_id)?
            .get_password()
            .map_err(|e| e.to_string())
    }

    pub fn delete(vault_id: &str) -> Result<(), String> {
        entry(vault_id)?
            .delete_credential()
            .map_err(|e| e.to_string())
    }
}

// ── Tauri commands ─────────────────────────────────────────────────────────

#[command]
pub async fn check_biometric_available() -> bool {
    false
}

#[command]
pub async fn enable_biometric(vault_id: String, vault_data: VaultData, password: String) -> Result<(), String> {
    let _ = (vault_id, vault_data, password);
    Err("biometric unlock is disabled until credentials can be hardware-bound".to_string())
}

#[command]
pub async fn biometric_unlock(
    vault_id: String,
    vault_data: VaultData,
    session: State<'_, NativeSessionState>,
) -> Result<usize, String> {
    let _ = (vault_id, vault_data, session);
    Err("biometric unlock is disabled until credentials can be hardware-bound".to_string())
}

#[command]
pub async fn reveal_seed_with_biometric(
    vault_id: String,
    vault_data: VaultData,
    account_index: usize,
) -> Result<String, String> {
    let _ = (vault_id, vault_data, account_index);
    Err("biometric seed reveal is disabled until credentials can be hardware-bound".to_string())
}

#[command]
pub async fn disable_biometric(vault_id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        validate_vault_id(&vault_id)?;
        cred_store::delete(&vault_id)
    })
        .await
        .map_err(|e| e.to_string())?
}
