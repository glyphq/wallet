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
html,body{{width:100%;height:100%;background:transparent;overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  user-select:none;-webkit-user-select:none}}
.n{{display:flex;align-items:center;gap:8px;padding:10px 12px;
  width:100%;height:100%;
  background:rgba(18,18,20,.96);
  border:1px solid rgba(255,255,255,.05);
  border-radius:12px;
  box-shadow:0 4px 24px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.2);
  cursor:pointer;position:relative;
  opacity:1;transform:translateY(0);
  transition:opacity .15s,transform .15s}}
.n.out{{opacity:0;transform:translateY(8px)}}
.ic{{flex-shrink:0;width:28px;height:28px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;background:{color}15}}
.ic svg{{width:15px;height:15px}}
.c{{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}}
.c h{{font-size:12px;font-weight:600;color:rgba(255,255,255,.92);line-height:1.2}}
.c b{{font-size:11px;color:rgba(255,255,255,.45);font-weight:400;line-height:1.3;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.x{{flex-shrink:0;background:none;border:none;padding:4px;cursor:pointer;
  display:flex;align-items:center;opacity:0;transition:opacity .1s}}
.n:hover .x{{opacity:.4}}
.x:hover{{opacity:.8}}
.p{{position:absolute;bottom:0;left:8px;right:8px;height:2px;border-radius:1px;opacity:.3;
  transform-origin:left;animation:sh {duration}ms linear forwards}}
@keyframes sh{{from{{transform:scaleX(1)}}to{{transform:scaleX(0)}}}}
</style></head><body>
<div class="n" id="n">
  <div class="ic"><svg viewBox="0 0 24 24" fill="none">{icon_svg}</svg></div>
  <div class="c"><h>{title}</h><b>{body}</b></div>
  <button class="x" id="x"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  <div class="p" style="background:{color}"></div>
</div>
<script>
var n=document.getElementById("n"),x=document.getElementById("x");
function close(){{n.classList.add("out");setTimeout(function(){{try{{window.close()}}catch(e)}}),150)}}
n.onclick=close;
x.onclick=function(e){{e.stopPropagation();close()}};
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
            (px + sw / sc - 376.0 - 16.0, py + sh / sc - 90.0 - 56.0)
        } else { (100.0, 100.0) }
    } else { (100.0, 100.0) };

    // Base64 encode to avoid </script> breaking the eval string
    let b64 = base64_encode(html.as_bytes());
    let eval_js = format!(
        "var d=atob('{}');document.open();document.write(d);document.close();",
        b64
    );

    // Spawn on separate thread — WebView2 deadlock on IPC thread (wry#583)
    let app2 = app.clone();
    std::thread::spawn(move || {
        let label = format!("notif-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());

        eprintln!("[notif] building...");

        // about:blank loads instantly — no network request, no React app overhead
        let url = "about:blank".parse::<url::Url>().unwrap();
        let _window = match WebviewWindowBuilder::new(&app2, &label, WebviewUrl::External(url))
            .inner_size(376.0, 76.0)
            .position(x, y)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .resizable(false)
            .skip_taskbar(true)
            .visible(false)
            .focused(false)
            .build()
        {
            Ok(w) => { eprintln!("[notif] built OK"); w }
            Err(e) => { eprintln!("[notif] build err: {e}"); return; }
        };

        // Inject immediately — about:blank is already loaded
        if let Some(w) = app2.get_webview_window(&label) {
            match w.eval(&eval_js) {
                Ok(_) => eprintln!("[notif] eval OK"),
                Err(e) => eprintln!("[notif] eval err: {e}"),
            }
            let _ = w.show();
        }

        // Safety net destroy — JS handles timing, this just cleans up stragglers
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
