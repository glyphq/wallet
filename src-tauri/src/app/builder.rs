//! Tauri builder assembly: plugins, managed state, setup, window events and
//! the command handler registration.

use crate::{biometric, commands, session_crypto, store_crypto, wallet_crypto};

use super::{launch, plugins, setup, window};

pub(crate) fn run() {
    launch::configure_runtime();

    let builder = tauri::Builder::<tauri::Wry>::default();
    let builder = plugins::register(builder);
    let builder = plugins::manage_state(builder);

    builder
        .setup(setup::configure)
        .on_window_event(window::handle_event)
        .invoke_handler(tauri::generate_handler![
            commands::auto_lock::reset_activity_timer,
            commands::auto_lock::set_lock_timeout,
            commands::auto_lock::set_lock_on_sleep,
            commands::auto_lock::get_seconds_until_lock,
            commands::auto_lock::force_lock,
            commands::deep_link::get_pending_request,
            commands::deep_link::clear_pending_request,
            commands::deep_link::accept_pending_request,
            commands::deep_link::authorize_pending_request,
            session_crypto::authorize_callback_message,
            commands::deep_link::take_pending_pay,
            commands::clipboard::copy_to_clipboard,
            commands::clipboard::clear_clipboard,
            commands::clipboard::lock_clipboard,
            commands::callback::post_callback,
            commands::app::set_hide_to_tray,
            commands::app::get_updater_context,
            store_crypto::encrypt_store_value,
            store_crypto::decrypt_store_value,
            wallet_crypto::encrypt_wallet,
            wallet_crypto::unlock_wallet_session,
            wallet_crypto::verify_wallet_password,
            wallet_crypto::add_seed_to_wallet,
            wallet_crypto::remove_seed_from_wallet,
            wallet_crypto::select_wallet_accounts,
            wallet_crypto::rotate_wallet_password,
            wallet_crypto::reveal_wallet_seed,
            session_crypto::get_session_accounts,
            session_crypto::store_session_seeds,
            session_crypto::clear_session_seeds,
            session_crypto::sign_transaction,
            session_crypto::sign_local_transaction,
            session_crypto::sign_message,
            session_crypto::sign_local_message,
            session_crypto::sign_callback_message,
            biometric::check_biometric_available,
            biometric::enable_biometric,
            biometric::biometric_unlock,
            biometric::reveal_seed_with_biometric,
            biometric::disable_biometric,
        ])
        .run(tauri::generate_context!())
        .expect("error while running glyph");
}
