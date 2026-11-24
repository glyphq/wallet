//! Dedicated secure window for reviewing external dApp requests.

use std::{thread, time::Duration};

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

pub(crate) const LABEL: &str = "approval";

const WINDOW_WIDTH: f64 = 640.0;
const WINDOW_HEIGHT: f64 = 440.0;
const START_WIDTH: f64 = 120.0;
const START_HEIGHT: f64 = 82.0;
const EDGE_MARGIN: f64 = 16.0;
const ANIMATION_FRAMES: u32 = 18;
const FRAME_TIME: Duration = Duration::from_millis(10);

/// Shows the approval window at the bottom-right of the main window's monitor.
///
/// The window is declared in the application configuration so it is
/// constructed with the main window at startup and stays hidden until a
/// request arrives. Creating windows lazily on Windows can deadlock the
/// WebView2 controller.
pub(crate) fn show(app: &AppHandle) -> tauri::Result<()> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or_else(|| tauri::Error::WindowNotFound)?;

    let monitor = app
        .get_webview_window("main")
        .and_then(|main| main.current_monitor().ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    };

    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let width = (WINDOW_WIDTH * scale).round() as u32;
    let height = (WINDOW_HEIGHT * scale).round() as u32;
    let margin = (EDGE_MARGIN * scale).round() as i32;
    let x = area.position.x + area.size.width as i32 - width as i32 - margin;
    let y = area.position.y + area.size.height as i32 - height as i32 - margin;

    if window.is_visible().unwrap_or(false) {
        window.set_size(PhysicalSize::new(width, height))?;
        window.set_position(PhysicalPosition::new(x, y))?;
        window.set_focus()?;
        return Ok(());
    }

    let start_width = (START_WIDTH * scale).round() as u32;
    let start_height = (START_HEIGHT * scale).round() as u32;
    let start_x = x + width as i32 - start_width as i32;
    let start_y = y + height as i32 - start_height as i32;

    window.set_size(PhysicalSize::new(start_width, start_height))?;
    window.set_position(PhysicalPosition::new(start_x, start_y))?;
    window.show()?;
    window.set_focus()?;

    let animating = window.clone();
    thread::spawn(move || {
        animate(&animating, x, y, width, height, start_width, start_height);
    });

    Ok(())
}

fn animate(window: &WebviewWindow, target_x: i32, target_y: i32, target_width: u32, target_height: u32, start_width: u32, start_height: u32) {
    for frame in 1..=ANIMATION_FRAMES {
        let t = frame as f64 / ANIMATION_FRAMES as f64;
        let eased = 1.0 - (1.0 - t).powi(3);
        let width = start_width as f64 + (target_width as f64 - start_width as f64) * eased;
        let height = start_height as f64 + (target_height as f64 - start_height as f64) * eased;
        let x = target_x + target_width as i32 - width.round() as i32;
        let y = target_y + target_height as i32 - height.round() as i32;

        let _ = window.set_size(PhysicalSize::new(width.round() as u32, height.round() as u32));
        let _ = window.set_position(PhysicalPosition::new(x, y));
        thread::sleep(FRAME_TIME);
    }

    let _ = window.set_size(PhysicalSize::new(target_width, target_height));
    let _ = window.set_position(PhysicalPosition::new(target_x, target_y));
}
