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

    // Encode notification data as base64 JSON
    let json = serde_json::to_string(&serde_json::json!({
        "kind": payload.kind,
        "title": payload.title,
        "body": payload.body,
        "duration": duration,
    }))
    .map_err(|e| e.to_string())?;
    let b64 = URL_SAFE_NO_PAD.encode(json.as_bytes());

    // Load the main app with data in the hash fragment.
    // The notification component reads window.location.href before the router strips it.
    let webview_url = if app.config().build.dev_url.is_some() {
        // In dev, load index.html (the React app) — data rides in the hash
        WebviewUrl::App("index.html".into())
    } else {
        WebviewUrl::App("index.html".into())
    };

    let hash = format!("#/notification?data={b64}");
    eprintln!("[notif] label={label} hash={hash}");
    eprintln!("[notif] json={json}");

    // Bottom-right of primary monitor, above the taskbar
    let (x, y) = if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let pos = monitor.position();
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let margin_right = 16.0;
            let margin_bottom = 56.0;
            let sx = (pos.x as f64) + (size.width as f64) / scale - 376.0 - margin_right;
            let sy = (pos.y as f64) + (size.height as f64) / scale - 100.0 - margin_bottom;
            eprintln!("[notif] monitor {size:?} @{scale} -> pos ({sx:.0},{sy:.0})");
            (sx, sy)
        } else {
            (100.0, 100.0)
        }
    } else {
        (100.0, 100.0)
    };

    let notif_app = app.clone();
    let close_label = label.clone();

    let window = WebviewWindowBuilder::new(&app, &label, webview_url)
        .title("")
        .inner_size(376.0, 100.0)
        .position(x, y)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(true)
        .focused(true)
        .devtools(true)
        .background_color(tauri::window::Color(15, 15, 15, 255))
        .build()
        .map_err(|e| {
            eprintln!("[notif] build failed: {e}");
            e.to_string()
        })?;

    eprintln!("[notif] window built, navigating to {hash}");

    // Navigate to the notification route with data in the hash
    let nav_url = format!("index.html/{hash}");
    if let Ok(parsed) = url::Url::parse(&format!("http://localhost/{nav_url}")) {
        let _ = window.navigate(parsed);
        eprintln!("[notif] navigated to {nav_url}");
    } else {
        eprintln!("[notif] failed to parse nav url: {nav_url}");
    }

    // Auto-close
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(duration));
        if let Some(w) = notif_app.get_webview_window(&close_label) {
            let _ = w.destroy();
        }
    });

    eprintln!("[notif] done, auto-close in {duration}ms");
    Ok(())
}
