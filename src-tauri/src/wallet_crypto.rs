//! Encrypted wallet storage and the commands that manage it.
//!
//! `crypto` holds the AES-256-GCM envelope and PBKDF2 key derivation, while
//! `commands` exposes encryption, unlocking and account management to the UI.

mod commands;
mod crypto;

#[cfg(test)]
mod tests;

pub use commands::*;
pub use crypto::WalletData;
// `encrypt_wallet_data` and `decrypt_wallet_data` are only used by the command
// layer now; keep the historical module-root paths without a warning.
#[allow(unused_imports)]
pub use crypto::{decrypt_wallet_data, encrypt_wallet_data};
