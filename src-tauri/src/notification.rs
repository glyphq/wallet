use serde::Deserialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
pub struct NotificationPayload {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub duration: Option<u64>,
}

// Embedded Geist font (latin, 400 + 600 weight)
const GEIST_400: &[u8] = include_bytes!("../fonts/geist-latin-400-normal.woff2");
const GEIST_600: &[u8] = include_bytes!("../fonts/geist-latin-600-normal.woff2");

fn build_html(kind: &str, title: &str, body: &str, duration: u64) -> String {
    let colors = [
        ("received", "#22c55e"),
        ("sent", "#3b82f6"),
        ("confirmed", "#06b6d4"),
        ("failed", "#ef4444"),
        ("expired", "#eab308"),
        ("deep_link", "#3b82f6"),
        ("price_alert", "#a855f7"),
    ];
    let icons = [
        ("received", r#"<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="C" stroke-width="1.5" fill="none"/><path d="M9 12l2 2 4-4" stroke="C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>"#),
        ("sent", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="1.5" fill="none"/><path d="M8 12h8m-4-4l4 4-4 4" stroke="C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>"#),
        ("confirmed", r#"<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="C" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M22 4L12 14.01l-3-3" stroke="C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>"#),
        ("failed", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="1.5" fill="none"/><path d="M15 9l-6 6m0-6l6 6" stroke="C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>"#),
        ("expired", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="1.5" fill="none"/><path d="M12 6v6l4 2" stroke="C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>"#),
        ("deep_link", r#"<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="C" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="C" stroke-width="1.5" fill="none" stroke-linecap="round"/>"#),
        ("price_alert", r#"<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="C" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 7 22 7 22 13" stroke="C" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>"#),
    ];

    let color = colors.iter().find(|(k, _)| *k == kind).map(|(_, c)| *c).unwrap_or("#22c55e");
    let icon = icons.iter().find(|(k, _)| *k == kind).map(|(_, i)| *i).unwrap_or(icons[0].1);
    let icon_svg = icon.replace('C', color);

    let esc = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;");
    let title = esc(title);
    let body = esc(body);

    let font400 = base64_encode(GEIST_400);
    let font600 = base64_encode(GEIST_600);

    format!(r##"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@font-face{{font-family:'Geist';src:url(data:font/woff2;base64,{font400}) format('woff2');font-weight:400;font-style:normal;font-display:swap}}
@font-face{{font-family:'Geist';src:url(data:font/woff2;base64,{font600}) format('woff2');font-weight:600;font-style:normal;font-display:swap}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:100%;height:100%;background:#0f0f0f;overflow:hidden;
  font-family:'Geist',system-ui,-apple-system,sans-serif;
  user-select:none;-webkit-user-select:none}}
.n{{display:flex;align-items:center;gap:12px;padding:14px 16px;
  width:100%;height:100%;
  background:#0f0f0f;
  cursor:pointer;position:relative}}
.ic{{flex-shrink:0;width:32px;height:32px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  background:{color}12}}
.ic svg{{width:17px;height:17px}}
.c{{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}}
.c h{{font-size:13px;font-weight:600;color:rgba(255,255,255,.88);line-height:1.3;letter-spacing:-.01em}}
.c b{{font-size:12px;color:rgba(255,255,255,.35);font-weight:400;line-height:1.3;letter-spacing:-.005em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.x{{flex-shrink:0;background:none;border:none;padding:4px;cursor:pointer;
  display:flex;align-items:center;border-radius:6px;
  opacity:0;transition:opacity .12s}}
.n:hover .x{{opacity:.25}}
.x:hover{{opacity:.6;background:rgba(255,255,255,.05)}}
</style></head><body>
<div class="n" id="n">
  <div class="ic"><svg viewBox="0 0 24 24" fill="none">{icon_svg}</svg></div>
  <div class="c"><h>{title}</h><b>{body}</b></div>
  <button class="x" id="x"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
</div>
<script>
var n=document.getElementById("n"),x=document.getElementById("x");
function close(){{n.style.opacity="0";n.style.transition="opacity .15s";
  setTimeout(function(){{try{{window.close()}}catch(e)}}),160)}}
n.addEventListener("click",close);
x.addEventListener("click",function(e){{e.stopPropagation();close()}});
setTimeout(close,{duration});
</script></body></html>"##)
}

/// Async — WebviewWindowBuilder::build() deadlocks on Windows in sync commands (wry#583).
#[tauri::command]
pub async fn show_notification_window(app: tauri::AppHandle, payload: NotificationPayload) -> Result<(), String> {
    let duration = payload.duration.unwrap_or(5000);
    let html = build_html(&payload.kind, &payload.title, &payload.body, duration);

    let (x, y) = if let Some(w) = app.get_webview_window("main") {
        if let Ok(Some(m)) = w.primary_monitor() {
            let (px, py, sw, sh, sc) = (m.position().x as f64, m.position().y as f64,
                m.size().width as f64, m.size().height as f64, m.scale_factor());
            (px + sw / sc - 380.0 - 16.0, py + sh / sc - 68.0 - 56.0)
        } else { (100.0, 100.0) }
    } else { (100.0, 100.0) };

    // Base64 encode the full HTML (includes embedded fonts + script)
    let b64 = base64_encode(html.as_bytes());
    let eval_js = format!("document.open();document.write(atob('{}'));document.close();", b64);

    // Spawn on separate thread — WebView2 deadlock on IPC thread (wry#583)
    let app2 = app.clone();
    std::thread::spawn(move || {
        let label = format!("notif-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());

        eprintln!("[notif] building...");

        let url = "about:blank".parse::<url::Url>().unwrap();
        let _window = match WebviewWindowBuilder::new(&app2, &label, WebviewUrl::External(url))
            .inner_size(380.0, 68.0)
            .position(x, y)
            .decorations(false)
            .always_on_top(true)
            .resizable(false)
            .skip_taskbar(true)
            .visible(false)
            .focused(false)
            .background_color(tauri::window::Color(22, 22, 24, 255))
            .build()
        {
            Ok(w) => { eprintln!("[notif] built OK"); w }
            Err(e) => { eprintln!("[notif] build err: {e}"); return; }
        };

        // about:blank loads instantly — inject right away
        if let Some(w) = app2.get_webview_window(&label) {
            match w.eval(&eval_js) {
                Ok(_) => eprintln!("[notif] eval OK"),
                Err(e) => eprintln!("[notif] eval err: {e}"),
            }
            let _ = w.show();
        }

        // Safety net destroy
        let app3 = app2.clone();
        let l2 = label.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(duration + 500));
            if let Some(w) = app3.get_webview_window(&l2) {
                let _ = w.destroy();
            }
        });
    });

    Ok(())
}

fn base64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        out.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 { out.push(CHARS[((triple >> 6) & 0x3F) as usize] as char); } else { out.push('='); }
        if chunk.len() > 2 { out.push(CHARS[(triple & 0x3F) as usize] as char); } else { out.push('='); }
    }
    out
}
