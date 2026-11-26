//! Tauri command surface, grouped by feature area.
//!
//! Each submodule owns one group of commands and its private helpers. The
//! command modules are registered by path in `app::builder::run`, so the set
//! and order of commands is unchanged from the original single-file module.

pub(crate) mod app;
pub(crate) mod auto_lock;
pub(crate) mod callback;
pub(crate) mod clipboard;
pub(crate) mod deep_link;
pub(crate) mod validation;

pub use app::HideToTrayState;
pub use validation::is_private_host;
