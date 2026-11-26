//! KangarooTwelve hashing as used by Qubic seeds, identities and signing.

use tiny_keccak::{Hasher, KangarooTwelve};

pub fn k12(input: &[u8], output_len: usize) -> Vec<u8> {
    let mut out = vec![0u8; output_len];
    let mut h = KangarooTwelve::new(b"");
    h.update(input);
    h.finalize(&mut out);
    out
}
