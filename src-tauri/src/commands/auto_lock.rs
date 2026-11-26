//! Auto-lock and manual lock commands.

use tauri::{AppHandle, Emitter, State};

use crate::auto_lock::{AutoLockState, MAX_LOCK_TIMEOUT_MINUTES, MIN_LOCK_TIMEOUT_MINUTES};
use crate::deep_link::DeepLinkState;
use crate::session_crypto::NativeSessionState;

#[tauri::command]
pub fn reset_activity_timer(state: State<'_, AutoLockState>) {
    state.reset();
}

#[tauri::command]
pub fn set_lock_timeout(minutes: u64, state: State<'_, AutoLockState>) {
    state.set_timeout(minutes.clamp(MIN_LOCK_TIMEOUT_MINUTES, MAX_LOCK_TIMEOUT_MINUTES));
}

#[tauri::command]
pub fn set_lock_on_sleep(enabled: bool, state: State<'_, AutoLockState>) {
    state.set_lock_on_sleep(enabled);
}

#[tauri::command]
pub fn get_seconds_until_lock(state: State<'_, AutoLockState>) -> Option<u64> {
    state.seconds_until_lock()
}

#[tauri::command]
pub fn force_lock(
    app: AppHandle,
    state: State<'_, AutoLockState>,
    session: State<'_, NativeSessionState>,
    authorization_state: State<'_, DeepLinkState>,
) {
    session.clear();
    authorization_state.clear_signing_authorizations();
    state.reset();
    app.emit("glyph:lock", ()).ok();
}
