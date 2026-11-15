//! Native session signing state and the commands that expose it to the UI.
//!
//! Seeds live only in memory (`state`), dApp signing requests are bound to the
//! payload the user reviewed (`authorization`), and the Tauri command surface
//! is re-exported from `commands`.

mod authorization;
mod commands;
mod state;

#[cfg(test)]
mod tests;

pub use commands::*;
pub(crate) use state::validate_session_seeds;
pub use state::NativeSessionState;
