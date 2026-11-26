mod app;
mod auto_lock;
mod biometric;
mod clipboard;
mod commands;
mod deep_link;
pub mod link_broker;
mod qubic_native;
mod session_crypto;
mod store_crypto;
mod wallet_crypto;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app::builder::run();
}
