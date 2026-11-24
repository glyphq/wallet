//! Tests for wallet envelope validation and unlock metadata.

use super::commands::session_metadata;
use super::crypto::{decrypt_wallet_data, WalletData, MAX_PBKDF2_ITERATIONS};

#[test]
fn rejects_excessive_iteration_counts_before_derivation() {
    let wallet = WalletData {
        version: 1,
        iterations: MAX_PBKDF2_ITERATIONS + 1,
        salt: "00".repeat(32),
        iv: "00".repeat(12),
        ciphertext: "00".repeat(16),
    };
    let non_secret_test_input = std::process::id().to_string();
    assert_eq!(
        decrypt_wallet_data(&wallet, &non_secret_test_input).unwrap_err(),
        "wallet iteration count exceeds the supported maximum"
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
