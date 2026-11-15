//! Native deep link handling for `glyph://` requests and pay links.
//!
//! The module is split by concern:
//! - `envelope` extracts and hashes v2 envelopes (canonical JSON, SHA-256).
//! - `url` validates dapp origins and delivery destinations.
//! - `request` parses and validates `glyph://v2/request` links.
//! - `pay` parses `glyph://pay` links.
//! - `replay` persists replay keys so accepted requests cannot be replayed.
//! - `state` owns the native queues and shared maps.
//! - `authorization` binds signing and callback capabilities to one review.
//! - `callback` validates signed callback payloads against the review.
//! - `handler` wires link events into the Tauri runtime.

mod authorization;
mod callback;
mod envelope;
mod handler;
mod pay;
mod replay;
mod request;
mod state;
mod url;

#[cfg(test)]
mod tests;

pub use handler::{process_url, register_handler};
pub use state::DeepLinkState;

pub use envelope::{
    callback_from_envelope_payload, replay_key_from_envelope_payload,
    replay_parts_from_envelope_payload,
};

const NONCE_STORE_PATH: &str = "glyph-security.json";
const NONCE_STORE_KEY: &str = "seen_nonces";
const MAX_NONCE_AGE_SECS: u64 = 3600;
const MAX_SIGN_MESSAGE_LEN: usize = 2048;
const MAX_PENDING_LINKS: usize = 16;
pub const MAX_SIGNING_AUTHORIZATION_AGE_SECS: u64 = 300;
// The relay is the only trusted cross-origin callback transport. Its exact
// origin and callback route remain constrained below, including a bounded nonce.
const OFFICIAL_RELAY_ORIGIN: &str = "https://relay.glyphq.org";
const REQUEST_PROTOCOL_V2: &str = "glyph-connect-request/2";
const CALLBACK_ENVELOPE_VERSION_V2: &str = "glyph-connect-callback-envelope/2";
