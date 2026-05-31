---
"sigil": patch
---

Fix AppImage launch and notifications on Linux.

- **Linux:** The AppImage now runs without FUSE by using the go-appimage FUSE-free runtime via AppImageKit's toolchain.
- **Linux:** Fixed a startup abort (`EGL_BAD_PARAMETER`) by stripping the bundled Ubuntu 22.04 WebKitGTK and WPE libs so the system-provided versions are used.
- **Linux:** Desktop notifications now work from AppImage — a local desktop entry and icon are registered automatically on first launch so GNOME's notification daemon accepts toasts.
