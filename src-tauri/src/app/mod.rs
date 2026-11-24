//! Application assembly: runtime configuration, plugin registration, tray and
//! window lifecycle wiring.
//!
//! `lib.rs` only owns module declarations and the `run` entry point; the setup
//! steps live here so each concern (plugins, state, tray, windows) stays small
//! and independently reviewable.

pub(crate) mod approval_window;
pub(crate) mod builder;
pub(crate) mod launch;
pub(crate) mod plugins;
pub(crate) mod setup;
pub(crate) mod tray;
pub(crate) mod window;
