use tauri::{AppHandle, Emitter, State};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::auto_lock::AutoLockState;
use crate::clipboard::ClipboardState;
use crate::deep_link::DeepLinkState;

#[tauri::command]
pub fn reset_activity_timer(state: State<'_, AutoLockState>) {
    state.reset();
}

#[tauri::command]
pub fn set_lock_timeout(minutes: u64, state: State<'_, AutoLockState>) {
    state.set_timeout(minutes);
}

#[tauri::command]
pub fn force_lock(app: AppHandle) {
    app.emit("sigil:lock", ()).ok();
}

#[tauri::command]
pub fn get_pending_request(state: State<'_, DeepLinkState>) -> Option<String> {
    state.peek()
}

#[tauri::command]
pub fn clear_pending_request(state: State<'_, DeepLinkState>) {
    state.take();
}

#[tauri::command]
pub fn copy_to_clipboard(
    text: String,
    clear_after_secs: u64,
    app: AppHandle,
    clip_state: State<'_, ClipboardState>,
) -> Result<(), String> {
    app.clipboard().write_text(&text).map_err(|e| e.to_string())?;
    clip_state.schedule_clear(clear_after_secs);
    Ok(())
}

#[tauri::command]
pub fn clear_clipboard(app: AppHandle, clip_state: State<'_, ClipboardState>) {
    app.clipboard().write_text("").ok();
    clip_state.cancel_clear();
}

#[tauri::command]
pub async fn post_callback(_url: String, _body: String) -> Result<(), String> {
    // Phase 3 — HTTP POST signed result to dApp callback URL
    Ok(())
}
