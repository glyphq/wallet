//! Qubic seed, public key and identity encoding.
//!
//! A seed is 55 lowercase letters.  Its subseed and private key are K12
//! outputs, the public key is the marshalled SchnorrQ base point multiple, and
//! an identity is the 60-character uppercase encoding of that public key.

use num_bigint::BigInt;
use num_traits::{ToPrimitive, Zero};

use super::field::le_u64;
use super::k12::k12;
use super::schnorrq::{point_marshal, scalar_base_mult};

const SEED_LENGTH: usize = 55;
const IDENTITY_LENGTH: usize = 60;

pub fn derive_keys(seed: &str) -> Result<(Vec<u8>, [u8; 32]), String> {
    if seed.len() != SEED_LENGTH || !seed.bytes().all(|b| b.is_ascii_lowercase()) {
        return Err("Invalid seed: expected 55 lowercase letters".into());
    }
    let seed_bytes: Vec<u8> = seed.bytes().map(|b| b - b'a').collect();
    let subseed = k12(&seed_bytes, 32);
    let private = k12(&subseed, 32);
    let public = point_marshal(&scalar_base_mult(&private))?;
    Ok((subseed, public))
}
pub fn public_key_from_seed(seed: &str) -> Result<[u8; 32], String> {
    Ok(derive_keys(seed)?.1)
}
fn encode_checksum(public_key: &[u8]) -> [u8; 4] {
    let checksum_bytes = k12(public_key, 3);
    let mut checksum = (checksum_bytes[0] as u32)
        | ((checksum_bytes[1] as u32) << 8)
        | ((checksum_bytes[2] as u32) << 16);
    checksum &= 0x3ffff;
    let mut out = [0u8; 4];
    for o in &mut out {
        *o = (checksum % 26) as u8 + b'A';
        checksum /= 26;
    }
    out
}
pub fn public_key_to_identity(public_key: &[u8]) -> Result<String, String> {
    if public_key.len() != 32 {
        return Err("Public keys must be exactly 32 bytes".into());
    }
    let mut chars = Vec::with_capacity(IDENTITY_LENGTH);
    for i in 0..4 {
        let mut frag = le_u64(&public_key[i * 8..i * 8 + 8]);
        for _ in 0..14 {
            let rem = (&frag % BigInt::from(26u32)).to_u8().unwrap();
            chars.push(rem + b'A');
            frag /= 26;
        }
    }
    chars.extend_from_slice(&encode_checksum(public_key));
    String::from_utf8(chars).map_err(|_| "identity utf8 error".to_string())
}
pub fn derive_identity_from_seed(seed: &str) -> Result<String, String> {
    public_key_to_identity(&public_key_from_seed(seed)?)
}

pub fn contract_index_to_identity(contract_index: u32) -> Result<String, String> {
    if contract_index == 0 {
        return Err("contract index must be positive".into());
    }
    let mut public_key = [0u8; 32];
    public_key[..4].copy_from_slice(&contract_index.to_le_bytes());
    public_key_to_identity(&public_key)
}
pub fn identity_to_public_key(identity: &str) -> Result<[u8; 32], String> {
    if identity.len() != IDENTITY_LENGTH || !identity.bytes().all(|b| b.is_ascii_uppercase()) {
        return Err(format!(
            "Invalid identity: expected 60 uppercase letters, got {} chars",
            identity.len()
        ));
    }
    let mut public = [0u8; 32];
    for fragment_index in 0..4 {
        let mut fragment = BigInt::zero();
        for digit_index in (0..14).rev() {
            let c = identity.as_bytes()[fragment_index * 14 + digit_index];
            fragment = fragment * 26 + BigInt::from(c - b'A');
        }
        let mut tmp = fragment;
        for j in 0..8 {
            public[fragment_index * 8 + j] = (&tmp & BigInt::from(0xffu32)).to_u8().unwrap();
            tmp >>= 8usize;
        }
    }
    let expected = encode_checksum(&public);
    if identity.as_bytes()[56..60] != expected {
        return Err("Invalid identity checksum".into());
    }
    Ok(public)
}
