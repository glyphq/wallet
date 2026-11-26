//! Qubic native primitives: identity derivation, SchnorrQ signing and the
//! transaction encoding used by the wallet.
//!
//! The implementation is split into the supporting field/curve arithmetic
//! (`field`, `schnorrq`), the K12 hash helper, identity encoding, and the
//! public transaction/message signing API re-exported below.

#![allow(dead_code)]

mod field;
mod identity;
mod k12;
mod schnorrq;
mod signing;

#[cfg(test)]
mod tests;

// `derive_keys`, `k12` and `sign_digest` are used inside the submodules and by
// the fixtures below, but not elsewhere in the crate; keep them reachable from
// the module root without an unused-import warning.
#[allow(unused_imports)]
pub use identity::derive_keys;
pub use identity::{
    contract_index_to_identity, derive_identity_from_seed, identity_to_public_key,
    public_key_from_seed, public_key_to_identity,
};
#[allow(unused_imports)]
pub use k12::k12;
#[allow(unused_imports)]
pub use signing::sign_digest;
pub use signing::{sign_message, sign_transaction};
