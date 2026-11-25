//! Separate always-on-top window for Glyph notification cards.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, State, WebviewUrl,
    WebviewWindowBuilder,
};

const WINDOW_LABEL: &str = "notification-overlay";
const WINDOW_WIDTH: f64 = 360.0;
const WINDOW_PADDING: f64 = 10.0;
const CARD_HEIGHT: f64 = 100.0;
const CARD_GAP: f64 = 8.0;
const SCREEN_MARGIN: f64 = 12.0;
const MAX_PENDING: usize = 20;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPayload {
    pub id: String,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub identity: Option<String>,
    pub tx_hash: Option<String>,
    pub duration_secs: u64,
    pub max_visible: usize,
    pub theme: String,
    pub position: String,
}

#[derive(Default)]
pub struct NotificationOverlayState {
    pending: Mutex<Vec<NotificationPayload>>,
    position: Mutex<String>,
}

impl NotificationOverlayState {
    fn push(&self, payload: NotificationPayload) {
        let mut pending = self.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.retain(|item| item.id != payload.id);
        pending.push(payload);
        let overflow = pending.len().saturating_sub(MAX_PENDING);
        if overflow > 0 {
            pending.drain(0..overflow);
        }
    }

    fn take_pending(&self) -> Vec<NotificationPayload> {
        let mut pending = self.pending.lock().unwrap_or_else(|e| e.into_inner());
        std::mem::take(&mut *pending)
    }

    fn dismiss(&self, id: &str) {
        let mut pending = self.pending.lock().unwrap_or_else(|e| e.into_inner());
        pending.retain(|item| item.id != id);
    }

    fn set_position(&self, position: String) {
        *self.position.lock().unwrap_or_else(|e| e.into_inner()) = position;
    }

    fn position(&self) -> String {
        self.position
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
}

fn overlay_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        return Ok(window);
    }
    WebviewWindowBuilder::new(
        app,
        WINDOW_LABEL,
        WebviewUrl::App("notification.html".into()),
    )
    .title("Glyph notifications")
    .inner_size(WINDOW_WIDTH, CARD_HEIGHT + WINDOW_PADDING * 2.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .focused(false)
    .focusable(false)
    .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
    .shadow(false)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())
}

/// Receives a notification from the main webview and forwards it to the overlay.
#[tauri::command]
pub async fn show_notification_window(
    app: AppHandle,
    state: State<'_, NotificationOverlayState>,
    notification: NotificationPayload,
    position: String,
) -> Result<(), String> {
    state.set_position(position);
    state.push(notification.clone());
    let window = overlay_window(&app)?;
    window
        .emit("glyph:notification", &notification)
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// Delivers notifications that arrived before the overlay webview was ready.
#[tauri::command]
pub fn get_pending_notifications(
    state: State<'_, NotificationOverlayState>,
) -> Vec<NotificationPayload> {
    state.take_pending()
}

#[tauri::command]
pub fn dismiss_notification(
    state: State<'_, NotificationOverlayState>,
    id: String,
) {
    state.dismiss(&id);
}

/// Resizes and anchors the overlay after its visible stack changes.
#[tauri::command]
pub fn layout_notification_overlay(
    app: AppHandle,
    state: State<'_, NotificationOverlayState>,
    count: usize,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(WINDOW_LABEL) else {
        return Ok(());
    };
    if count == 0 {
        return window.hide().map_err(|error| error.to_string());
    }

    let position = state.position();
    let visible = count.min(5) as f64;
    let height = WINDOW_PADDING * 2.0
        + visible * CARD_HEIGHT
        + (visible - 1.0).max(0.0) * CARD_GAP;
    window
        .set_size(LogicalSize::new(WINDOW_WIDTH, height))
        .map_err(|error| error.to_string())?;

    let monitor = app
        .get_webview_window("main")
        .and_then(|main| main.current_monitor().ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let width = WINDOW_WIDTH * scale;
    let height = height * scale;
    let margin = SCREEN_MARGIN * scale;
    let x = if position.ends_with("right") {
        f64::from(work.position.x) + f64::from(work.size.width) - width - margin
    } else {
        f64::from(work.position.x) + margin
    };
    let y = if position.starts_with("bottom") {
        f64::from(work.position.y) + f64::from(work.size.height) - height - margin
    } else {
        f64::from(work.position.y) + margin
    };
    window
        .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())
}
