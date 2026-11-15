//! Byte-for-byte fixtures shared with the upstream Qubic implementation.

use super::signing::MAX_INPUT_SIZE;
use super::*;

const SEED_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const IDENTITY_A: &str = "BZBQFLLBNCXEMGLOBHUVFTLUPLVCPQUASSILFABOFFBCADQSSUPNWLZBQEXK";
const IDENTITY_B: &str = "DJZMUACQMTYFSEJEYLDBWIGELSFCBMBLPCMBBYFXJHLTGWKHTRRJXTDEHTFL";

#[test]
fn k12_empty_matches_known() {
    assert_eq!(
        hex::encode(k12(b"", 32)),
        "1ac2d450fc3b4205d19da7bfca1b37513c0803577ac7167f06fe2ce1f0ef39e5"
    );
}

#[test]
fn derives_upstream_key_and_identity_fixture() {
    assert_eq!(
        hex::encode(public_key_from_seed(SEED_A).unwrap()),
        "1f590d03e613bdded38b4c0820ac44615f91af12435980b3ede3c08c315a2544"
    );
    assert_eq!(derive_identity_from_seed(SEED_A).unwrap(), IDENTITY_A);
    assert_eq!(
        public_key_to_identity(&identity_to_public_key(IDENTITY_B).unwrap()).unwrap(),
        IDENTITY_B
    );
}

#[test]
fn signs_upstream_message_fixture_byte_for_byte() {
    let (signature, public_key, identity) = sign_message(SEED_A, b"hello qubic").unwrap();
    assert_eq!(hex::encode(signature), "08314b48ca73edcb07e3b91ad3ada41f6a99de0f9209ac13ba4647e5f0c76d25dab6aa9a078b4576c72ad00d05c5af1aa73df256a5b81e263dcd490eec7d2000");
    assert_eq!(
        hex::encode(public_key),
        "1f590d03e613bdded38b4c0820ac44615f91af12435980b3ede3c08c315a2544"
    );
    assert_eq!(identity, IDENTITY_A);
}

#[test]
fn signs_upstream_transfer_fixture_byte_for_byte() {
    let (encoded, hash) = sign_transaction(
        SEED_A,
        IDENTITY_B,
        123_456_789,
        18_500_005,
        Some(18_500_000),
        0,
        &[],
    )
    .unwrap();
    assert_eq!(encoded, "H1kNA+YTvd7Ti0wIIKxEYV+RrxJDWYCz7ePAjDFaJUSR9s+QT3zfoVkRgS6NH21MxVAZhz7zIf6BTOuJxN+3jhXNWwcAAAAApUkaAQAAAACZOflcDgKfRp05kvzeeLV2LOzf6N53T4mlK770dO2FSjzZovW7jCs7rdqnXI+Nlb5Jh/FO+kuILUXKS0GAVwkA");
    assert_eq!(
        hash,
        "obllacnvrgymjgtpdclwvfqztizgbaxbiydxalaweewvtcfcwequxiiddmdn"
    );
}

#[test]
fn rejects_invalid_inputs() {
    assert!(public_key_from_seed("short").is_err());
    assert!(identity_to_public_key(&"A".repeat(60)).is_err());
    assert!(sign_transaction(SEED_A, IDENTITY_B, 1, 10, Some(10), 0, &[]).is_err());
    assert!(sign_transaction(
        SEED_A,
        IDENTITY_B,
        1,
        11,
        Some(10),
        0,
        &vec![0; MAX_INPUT_SIZE + 1]
    )
    .is_err());
}
