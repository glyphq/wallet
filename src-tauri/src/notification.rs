use serde::Deserialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
pub struct NotificationPayload {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub duration: Option<u64>,
}

fn pct_encode(v: &str) -> String {
    let mut s = String::with_capacity(v.len() * 3);
    for b in v.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => s.push(b as char),
            b' ' => s.push('+'),
            _ => { s.push('%'); s.push_str(&format!("{:02X}", b)); }
        }
    }
    s
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

    let qs = format!(
        "kind={}&title={}&body={}&duration={}",
        pct_encode(&payload.kind),
        pct_encode(&payload.title),
        pct_encode(&payload.body),
        duration,
    );

    let webview_url = if let Some(dev_url) = app.config().build.dev_url.clone() {
        let mut url = dev_url.to_string().trim_end_matches('/').to_string();
        url.push_str("/notification.html?");
        url.push_str(&qs);
        let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
        eprintln!("[notif] dev url: {parsed}");
        WebviewUrl::External(parsed)
    } else {
        let path = format!("notification.html?{qs}");
        eprintln!("[notif] app path: {path}");
        WebviewUrl::App(path.into())
    };

    let (x, y) = if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let pos = monitor.position();
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let margin_right = 16.0;
            let margin_bottom = 56.0;
            let sx = (pos.x as f64) + (size.width as f64) / scale - 376.0 - margin_right;
            let sy = (pos.y as f64) + (size.height as f64) / scale - 100.0 - margin_bottom;
            eprintln!("[notif] monitor pos=({},{}) size={}x{} scale={scale} -> window=({sx:.0},{sy:.0})",
                pos.x, pos.y, size.width, size.height);
            (sx, sy)
        } else {
            eprintln!("[notif] no primary monitor, using fallback (100,100)");
            (100.0, 100.0)
        }
    } else {
        eprintln!("[notif] no main window, using fallback (100,100)");
        (100.0, 100.0)
    };

    eprintln!("[notif] creating window '{label}' at ({x:.0},{y:.0}), size 376x100, duration {duration}ms");

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
        .focused(true)
        .devtools(true)
        .background_color(tauri::window::Color(15, 15, 15, 255))
        .build()
        .map_err(|e| {
            eprintln!("[notif] FAILED to build window: {e}");
            e.to_string()
        })?;

    eprintln!("[notif] window '{label}' created successfully");

    // Force-open devtools so we can see what's going on
    _window.open_devtools();
    eprintln!("[notif] devtools opened for '{label}'");

    // Auto-close after duration
    let destroy_label = close_label.clone();
    std::thread::spawn(move || {
        eprintln!("[notif] auto-close thread started for '{destroy_label}', sleeping {duration}ms");
        std::thread::sleep(std::time::Duration::from_millis(duration));
        match notif_app.get_webview_window(&destroy_label) {
            Some(w) => {
                eprintln!("[notif] destroying window '{destroy_label}'");
                let _ = w.destroy();
                eprintln!("[notif] window '{destroy_label}' destroyed");
            }
            None => {
                eprintln!("[notif] window '{destroy_label}' not found for destroy (already closed?)");
            }
        }
    });

    Ok(())
}
