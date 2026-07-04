use serde::Deserialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
pub struct NotificationPayload {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub duration: Option<u64>,
}

/// Full notification HTML served by the custom protocol handler.
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
html,body{{background:transparent;height:100%;overflow:hidden;font-family:-apple-system,system-ui,sans-serif;user-select:none;-webkit-user-select:none}}
.c{{position:fixed;inset:6px;display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:14px;background:rgba(22,22,24,.95);border:1px solid rgba(255,255,255,.06);box-shadow:0 8px 32px rgba(0,0,0,.6);overflow:hidden;cursor:pointer;opacity:1;transform:translateX(0);transition:opacity .2s,transform .2s}}
.c.out{{opacity:0;transform:translateX(40px)}}
.b{{position:absolute;top:0;left:12px;right:12px;height:2px;border-radius:1px;opacity:.6;background:linear-gradient(90deg,{color}00,{color},{color}00)}}
.i{{flex-shrink:0;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:{color}18}}
.i svg{{width:18px;height:18px}}
.t{{flex:1;min-width:0}}
.t h{{display:block;font-size:13px;font-weight:600;color:#fff;line-height:1.3;letter-spacing:-.01em}}
.t b{{display:block;font-size:12px;color:rgba(255,255,255,.55);line-height:1.4;margin-top:2px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.x{{flex-shrink:0;background:none;border:none;padding:4px;cursor:pointer;display:flex;align-items:center;opacity:.3;transition:opacity .15s}}
.x:hover{{opacity:.7}}
.p{{position:absolute;bottom:0;left:0;width:100%;height:2px;opacity:.35;transform-origin:left;animation:sh {duration}ms linear forwards}}
@keyframes sh{{from{{transform:scaleX(1)}}to{{transform:scaleX(0)}}}}
</style></head><body><div class="c" id="c"><div class="b"></div><div class="i"><svg viewBox="0 0 24 24" fill="none">{icon_svg}</svg></div><div class="t"><h>{title}</h><b>{body}</b></div><button class="x" id="x"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><div class="p" style="background:{color}"></div></div><script>function close(){{document.getElementById("c").classList.add("out");setTimeout((function(){{try{{window.close()}}catch(e)}}),200)}}document.getElementById("c").onclick=close;document.getElementById("x").onclick=function(e){{e.stopPropagation();close()}};setTimeout(close,{duration})</script></body></html>"##)
}

pub fn handle_notif_protocol<R: tauri::Runtime>(
    _ctx: tauri::UriSchemeContext<'_, R>,
    request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
    eprintln!("[notif] PROTOCOL HANDLER FIRED! uri={}", request.uri());

    let params: std::collections::HashMap<String, String> =
        url::Url::parse(&request.uri().to_string()).ok()
            .map(|u| u.query_pairs().into_owned().collect())
            .unwrap_or_default();

    let kind = params.get("kind").cloned().unwrap_or_default();
    let title = params.get("title").cloned().unwrap_or_default();
    let body = params.get("body").cloned().unwrap_or_default();
    let duration = params.get("duration").and_then(|d| d.parse::<u64>().ok()).unwrap_or(5000);

    let html = build_html(&kind, &title, &body, duration);
    let bytes = html.into_bytes();
    eprintln!("[notif] responding with {} bytes", bytes.len());

    http::Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(bytes)
        .unwrap()
}

#[tauri::command]
pub fn show_notification_window(app: tauri::AppHandle, payload: NotificationPayload) -> Result<(), String> {
    let label = format!("notif-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());
    let duration = payload.duration.unwrap_or(5000);

    let (x, y) = if let Some(w) = app.get_webview_window("main") {
        if let Ok(Some(m)) = w.primary_monitor() {
            let (px, py, sw, sh, sc) = (m.position().x as f64, m.position().y as f64,
                m.size().width as f64, m.size().height as f64, m.scale_factor());
            (px + sw / sc - 376.0 - 16.0, py + sh / sc - 100.0 - 56.0)
        } else { (100.0, 100.0) }
    } else { (100.0, 100.0) };

    let url = format!("notif://localhost/?kind={}&title={}&body={}&duration={}",
        urlencoding::encode(&payload.kind),
        urlencoding::encode(&payload.title),
        urlencoding::encode(&payload.body),
        duration,
    );
    eprintln!("[notif] label={label}");
    eprintln!("[notif] url={url}");
    eprintln!("[notif] building at ({x:.0},{y:.0})");

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::CustomProtocol(url.parse().map_err(|e: url::ParseError| e.to_string())?))
        .inner_size(376.0, 100.0)
        .position(x, y)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(true)
        .focused(false)
        .background_color(tauri::window::Color(15, 15, 15, 255))
        .initialization_script("console.log('[notif] init_script ran'); document.title='NOTIF_READY';")
        .build()
        .map_err(|e| { eprintln!("[notif] build failed: {e}"); e.to_string() })?;

    eprintln!("[notif] built OK");

    // Auto-close safety net
    let app2 = app.clone();
    let l2 = label.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(duration + 3000));
        if let Some(w) = app2.get_webview_window(&l2) {
            let _ = w.destroy();
        }
    });

    Ok(())
}
