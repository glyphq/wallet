//! Encrypted vault storage and the commands that manage it.
//!
//! `crypto` holds the AES-256-GCM envelope and PBKDF2 key derivation, while
//! `commands` exposes encryption, unlocking and account management to the UI.

mod commands;
mod crypto;

#[cfg(test)]
mod tests;

pub use commands::*;
pub use crypto::VaultData;
// `encrypt_vault_data` and `decrypt_vault_data` are only used by the command
// layer now; keep the historical module-root paths without a warning.
#[allow(unused_imports)]
pub use crypto::{decrypt_vault_data, encrypt_vault_data};
