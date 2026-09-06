fn main() {
    // An explicit manifest prevents future registered commands from becoming
    // callable by the WebView until they have been deliberately reviewed here.
    // Keep this list aligned with `tauri::generate_handler!` in `src/lib.rs`.
    let manifest = tauri_build::AppManifest::new().commands(&[
        "reset_activity_timer",
        "set_lock_timeout",
        "set_lock_on_sleep",
        "get_seconds_until_lock",
        "force_lock",
        "get_pending_request",
        "clear_pending_request",
        "accept_pending_request",
        "take_pending_pay",
        "copy_to_clipboard",
        "clear_clipboard",
        "lock_clipboard",
        "post_callback",
        "set_hide_to_tray",
        "get_updater_context",
        "encrypt_store_value",
        "decrypt_store_value",
        "encrypt_vault",
        "decrypt_vault",
        "store_session_seeds",
        "clear_session_seeds",
        "sign_transaction",
        "sign_message",
        "sign_callback_message",
        "check_biometric_available",
        "enable_biometric",
        "biometric_unlock",
        "reveal_seed_with_biometric",
        "disable_biometric",
    ]);

    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to build Tauri application manifest");
}
