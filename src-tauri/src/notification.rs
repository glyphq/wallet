use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
pub struct NotificationPayload {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub duration: Option<u64>,
}

#[tauri::command]
pub fn show_notification_window(app: tauri::AppHandle, payload: NotificationPayload) -> Result<(), String> {
    let label = format!(
        "notif-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let duration = payload.duration.unwrap_or(5000);

    // Encode notification data as base64 in the hash query
    let json = serde_json::to_string(&serde_json::json!({
        "kind": payload.kind,
        "title": payload.title,
        "body": payload.body,
        "duration": duration,
    }))
    .map_err(|e| e.to_string())?;
    let b64 = URL_SAFE_NO_PAD.encode(json.as_bytes());

    let hash_path = format!("#/notification?data={b64}");

    let webview_url = if let Some(dev_url) = app.config().build.dev_url.clone() {
        let mut url = dev_url.to_string().trim_end_matches('/').to_string();
        url.push('/');
        url.push_str(&hash_path);
        WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?)
    } else {
        WebviewUrl::App(format!("index.html/{hash_path}").into())
    };

    // Bottom-right of primary monitor, above the taskbar
    let (x, y) = if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let pos = monitor.position();
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let margin_right = 16.0;
            let margin_bottom = 56.0; // clear the taskbar
            let sx = (pos.x as f64) + (size.width as f64) / scale - 376.0 - margin_right;
            let sy = (pos.y as f64) + (size.height as f64) / scale - 100.0 - margin_bottom;
            (sx, sy)
        } else {
            (100.0, 100.0)
        }
    } else {
        (100.0, 100.0)
    };

    let notif_app = app.clone();
    let close_label = label.clone();

    let _window = WebviewWindowBuilder::new(&app, &label, webview_url)
        .title("")
        .inner_size(376.0, 100.0)
        .min_inner_size(376.0, 100.0)
        .max_inner_size(376.0, 100.0)
        .position(x, y)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(true)
        .focused(false)
        // Dark background — prevents white flash before HTML loads
        .background_color(tauri::window::Color(15, 15, 15, 255))
        .build()
        .map_err(|e| e.to_string())?;

    // Auto-close after duration
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(duration));
        if let Some(w) = notif_app.get_webview_window(&close_label) {
            let _ = w.destroy();
        }
    });

    Ok(())
}
