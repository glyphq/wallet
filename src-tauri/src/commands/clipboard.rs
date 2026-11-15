//! Clipboard read/write commands with scheduled clearing.

use tauri::{AppHandle, State};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::clipboard::ClipboardState;

const MAX_CLIPBOARD_CLEAR_SECS: u64 = 300;

#[tauri::command]
pub fn copy_to_clipboard(
    text: String,
    clear_after_secs: u64,
    app: AppHandle,
    clip_state: State<'_, ClipboardState>,
) -> Result<(), String> {
    app.clipboard()
        .write_text(&text)
        .map_err(|e| e.to_string())?;
    clip_state.schedule_clear(clear_after_secs.min(MAX_CLIPBOARD_CLEAR_SECS), &text);
    Ok(())
}

#[tauri::command]
pub fn clear_clipboard(app: AppHandle, clip_state: State<'_, ClipboardState>) {
    app.clipboard().write_text("").ok();
    clip_state.cancel_clear();
}

#[tauri::command]
pub fn lock_clipboard(app: AppHandle, clip_state: State<'_, ClipboardState>) {
    clip_state.clear_if_owned(&app);
}
