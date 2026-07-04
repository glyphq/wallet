use serde::Deserialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
pub struct NotificationPayload {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub duration: Option<u64>,
}

fn build_html(kind: &str, title: &str, body: &str, duration: u64) -> String {
    let colors = [
        ("received", "#4ade80"), ("sent", "#60a5fa"), ("confirmed", "#ccfcfb"),
        ("failed", "#f87171"), ("expired", "#fbbf24"), ("deep_link", "#60a5fa"),
        ("price_alert", "#c084fc"),
    ];
    let icons = [
        ("received", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="2" fill="none"/><path d="M8 12l3 3 5-5" stroke="C" stroke-width="2" stroke-linecap="round" fill="none"/>"#),
        ("sent", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="2" fill="none"/><path d="M12 16V8m0 0l-3 3m3-3l3 3" stroke="C" stroke-width="2" stroke-linecap="round" fill="none"/>"#),
        ("confirmed", r#"<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="C" stroke-width="2" fill="none"/><path d="M9 12l2 2 4-4" stroke="C" stroke-width="2" stroke-linecap="round" fill="none"/>"#),
        ("failed", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="2" fill="none"/><path d="M12 8v4m0 4h.01" stroke="C" stroke-width="2" stroke-linecap="round"/>"#),
        ("expired", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="2" fill="none"/><path d="M12 6v6l4 2" stroke="C" stroke-width="2" stroke-linecap="round" fill="none"/>"#),
        ("deep_link", r#"<circle cx="10" cy="14" r="3.5" stroke="C" stroke-width="2" fill="none"/><path d="M15 2s-1.5 4-4.5 6c-3 2-3 6 0 8s6.5 2 8-1" stroke="C" stroke-width="2" stroke-linecap="round" fill="none"/>"#),
        ("price_alert", r#"<circle cx="12" cy="12" r="10" stroke="C" stroke-width="2" fill="none"/><path d="M13 2s-1.5 4-4.5 6c-3 2-3 6 0 8s6.5 2 8-1" stroke="C" stroke-width="2" stroke-linecap="round" fill="none"/>"#),
    ];

    let color = colors.iter().find(|(k, _)| *k == kind).map(|(_, c)| *c).unwrap_or("#4ade80");
    let icon = icons.iter().find(|(k, _)| *k == kind).map(|(_, i)| *i).unwrap_or(icons[0].1);
    let icon_svg = icon.replace('C', color);

    let esc = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;");
    let title = esc(title);
    let body = esc(body);

    format!(r##"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:100%;height:100%;background:#161618;overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  user-select:none;-webkit-user-select:none}}
.n{{display:flex;align-items:center;gap:12px;padding:16px 18px;
  width:100%;height:100%;
  background:#161618;
  cursor:pointer;position:relative}}
.ic{{flex-shrink:0;width:34px;height:34px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;background:{color}14}}
.ic svg{{width:18px;height:18px}}
.c{{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}}
.c h{{font-size:14px;font-weight:600;color:rgba(255,255,255,.92);line-height:1.25;letter-spacing:-.01em}}
.c b{{font-size:12.5px;color:rgba(255,255,255,.42);font-weight:400;line-height:1.35;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.x{{flex-shrink:0;background:none;border:none;padding:6px;cursor:pointer;
  display:flex;align-items:center;border-radius:6px;
  opacity:0;transition:opacity .15s}}
.n:hover .x{{opacity:.35}}
.x:hover{{opacity:.8;background:rgba(255,255,255,.06)}}
.p{{position:absolute;bottom:0;left:12px;right:12px;height:2px;border-radius:1px;
  opacity:.25;transform-origin:left;animation:shrink {duration}ms linear forwards}}
@keyframes shrink{{from{{transform:scaleX(1)}}to{{transform:scaleX(0)}}}}
</style></head><body>
<div class="n" id="n">
  <div class="ic"><svg viewBox="0 0 24 24" fill="none">{icon_svg}</svg></div>
  <div class="c"><h>{title}</h><b>{body}</b></div>
  <button class="x" id="x"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  <div class="p" style="background:{color}"></div>
</div>
<script>
var n=document.getElementById("n"),x=document.getElementById("x");
function close(){{n.classList.add("out");setTimeout(function(){{try{{window.close()}}catch(e)}}),200)}}
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
            (px + sw / sc - 380.0 - 16.0, py + sh / sc - 88.0 - 56.0)
        } else { (100.0, 100.0) }
    } else { (100.0, 100.0) };

    // Base64 encode — avoids all escaping issues with </script>, quotes, etc.
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
            .inner_size(380.0, 88.0)
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
