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
    let label = format!("notif-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());

    let duration = payload.duration.unwrap_or(5000);

    eprintln!("[notif] === START === label={label}");
    eprintln!("[notif] kind={} title={}", payload.kind, payload.title);

    let (x, y) = if let Some(w) = app.get_webview_window("main") {
        if let Ok(Some(m)) = w.primary_monitor() {
            let (px, py, sw, sh, sc) = (m.position().x as f64, m.position().y as f64,
                m.size().width as f64, m.size().height as f64, m.scale_factor());
            let sx = px + sw / sc - 376.0 - 16.0;
            let sy = py + sh / sc - 100.0 - 56.0;
            eprintln!("[notif] pos=({sx:.0},{sy:.0})");
            (sx, sy)
        } else { (100.0, 100.0) }
    } else { (100.0, 100.0) };

    // Inject notification data as a global BEFORE the React app boots.
    // The app checks window.__NOTIF_DATA__ and renders the notification directly, no router.
    let inject_js = format!(
        "window.__NOTIF_DATA__ = {};",
        serde_json::to_string(&serde_json::json!({
            "kind": payload.kind, "title": payload.title, "body": payload.body, "duration": duration,
        })).map_err(|e| e.to_string())?
    );
    eprintln!("[notif] inject: {inject_js}");
    eprintln!("[notif] building window with initial script...");

    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .initialization_script(&inject_js)
        .inner_size(376.0, 100.0)
        .position(x, y)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(true)
        .focused(true)
        .background_color(tauri::window::Color(15, 15, 15, 255))
        .build()
        .map_err(|e| { eprintln!("[notif] BUILD FAILED: {e}"); e.to_string() })?;

    eprintln!("[notif] window built OK");

    // Auto-close
    let app2 = app.clone();
    let l2 = label.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(duration));
        eprintln!("[notif] auto-close {l2}");
        if let Some(w) = app2.get_webview_window(&l2) { let _ = w.destroy(); }
    });

    eprintln!("[notif] === DONE ===");
    Ok(())
}
