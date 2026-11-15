//! Transaction and message signing on top of the SchnorrQ primitives.

use num_bigint::BigInt;
use num_traits::{ToPrimitive, Zero};

use super::field::{bigint_to_bytes, bytes_to_bigint, le_u64, order};
use super::identity::{
    derive_keys, identity_to_public_key, public_key_from_seed, public_key_to_identity,
};
use super::k12::k12;
use super::schnorrq::{point_marshal, scalar_base_mult};

const HEADER_SIZE: usize = 80;
const SIG_SIZE: usize = 64;
const PK_SIZE: usize = 32;
pub(super) const MAX_INPUT_SIZE: usize = 1024;

pub fn sign_digest(message_digest: &[u8], seed: &str) -> Result<[u8; 64], String> {
    let (subseed, public_key) = derive_keys(seed)?;
    let sub_seed_hash = k12(&subseed, 64);
    let mut temp = [0u8; 64];
    temp[..32].copy_from_slice(&sub_seed_hash[32..64]);
    temp[32..].copy_from_slice(message_digest);
    let temp_hash = k12(&temp, 64);
    let r_scalar_bytes = &temp_hash[..32];
    let r_value = bytes_to_bigint(r_scalar_bytes) % order();
    let point_r = scalar_base_mult(r_scalar_bytes);
    let point_r_encoding = point_marshal(&point_r)?;
    let mut final_temp = [0u8; 96];
    final_temp[..32].copy_from_slice(&point_r_encoding);
    final_temp[32..64].copy_from_slice(&public_key);
    final_temp[64..].copy_from_slice(message_digest);
    let final_hash = k12(&final_temp, 64);
    let k_value = bytes_to_bigint(&final_hash[..32]) % order();
    let a_value = bytes_to_bigint(&sub_seed_hash[..32]) % order();
    let ord = order();
    let mut s_value = (r_value - (k_value * a_value % &ord)) % &ord;
    if s_value < BigInt::zero() {
        s_value += &ord;
    }
    let mut sig = [0u8; 64];
    sig[..32].copy_from_slice(&point_r_encoding);
    sig[32..].copy_from_slice(&bigint_to_bytes(&s_value));
    Ok(sig)
}

pub fn sign_message(seed: &str, message: &[u8]) -> Result<(Vec<u8>, Vec<u8>, String), String> {
    let digest = k12(message, 32);
    let sig = sign_digest(&digest, seed)?;
    let public = public_key_from_seed(seed)?;
    let identity = public_key_to_identity(&public)?;
    Ok((sig.to_vec(), public.to_vec(), identity))
}

fn write_i64_le(out: &mut Vec<u8>, v: i64) {
    out.extend_from_slice(&v.to_le_bytes())
}
fn write_u32_le(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes())
}
fn write_u16_le(out: &mut Vec<u8>, v: u16) {
    out.extend_from_slice(&v.to_le_bytes())
}
fn encode_tx_hash(bytes: &[u8]) -> String {
    let digest = k12(bytes, 32);
    let mut chars = Vec::with_capacity(60);
    for i in 0..4 {
        let mut frag = le_u64(&digest[i * 8..i * 8 + 8]);
        for _ in 0..14 {
            let rem = (&frag % BigInt::from(26u32)).to_u8().unwrap();
            chars.push(rem + b'a');
            frag /= 26;
        }
    }
    let checksum_bytes = k12(&digest, 3);
    let mut checksum = (checksum_bytes[0] as u32)
        | ((checksum_bytes[1] as u32) << 8)
        | ((checksum_bytes[2] as u32) << 16);
    checksum &= 0x3ffff;
    for _ in 0..4 {
        chars.push((checksum % 26) as u8 + b'a');
        checksum /= 26;
    }
    String::from_utf8(chars).unwrap()
}
pub fn sign_transaction(
    seed: &str,
    destination: &str,
    amount: i64,
    target_tick: u32,
    current_tick: Option<u32>,
    input_type: u16,
    payload: &[u8],
) -> Result<(String, String), String> {
    if payload.len() > MAX_INPUT_SIZE {
        return Err(format!("Payload too large: {} bytes", payload.len()));
    }
    if let Some(cur) = current_tick {
        if target_tick <= cur {
            return Err("target tick is not in the future".into());
        }
    }
    let source = public_key_from_seed(seed)?;
    let dest = identity_to_public_key(destination)?;
    let mut tx = Vec::with_capacity(HEADER_SIZE + payload.len() + SIG_SIZE);
    tx.extend_from_slice(&source);
    tx.extend_from_slice(&dest);
    write_i64_le(&mut tx, amount);
    write_u32_le(&mut tx, target_tick);
    write_u16_le(&mut tx, input_type);
    write_u16_le(&mut tx, payload.len() as u16);
    tx.extend_from_slice(payload);
    let digest = k12(&tx, 32);
    let sig = sign_digest(&digest, seed)?;
    tx.extend_from_slice(&sig);
    let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &tx);
    let hash = encode_tx_hash(&tx);
    Ok((encoded, hash))
}
