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

    eprintln!("[notif] label={label}");

    // Inject data before React boots. CSP now includes 'unsafe-eval' so this works.
    let init = format!(
        r#"window.__NOTIF_DATA__ = JSON.parse('{}')"#,
        serde_json::to_string(&serde_json::json!({
            "kind": payload.kind,
            "title": payload.title,
            "body": payload.body,
            "duration": duration,
        })).map_err(|e| e.to_string())?.replace('\\', "\\\\").replace('\'', "\\'")
    );

    eprintln!("[notif] init_script: {init}");

    let (x, y) = if let Some(w) = app.get_webview_window("main") {
        if let Ok(Some(m)) = w.primary_monitor() {
            let (px, py, sw, sh, sc) = (m.position().x as f64, m.position().y as f64,
                m.size().width as f64, m.size().height as f64, m.scale_factor());
            (px + sw / sc - 376.0 - 16.0, py + sh / sc - 100.0 - 56.0)
        } else { (100.0, 100.0) }
    } else { (100.0, 100.0) };

    let _window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .initialization_script(&init)
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
        .map_err(|e| { eprintln!("[notif] build failed: {e}"); e.to_string() })?;

    eprintln!("[notif] built OK");

    let app2 = app.clone();
    let l2 = label.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(duration + 500));
        if let Some(w) = app2.get_webview_window(&l2) { let _ = w.destroy(); }
    });

    Ok(())
}
