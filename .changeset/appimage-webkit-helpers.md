---
"sigil": patch
---

Fix AppImage crashing on startup with WebKit subprocess error.

- **Linux:** Fixed `SIGABRT` caused by `WebKitNetworkProcess` not being found. Tauri's bundler only copies shared libraries, not WebKit's executable helpers — they are now explicitly included in the AppImage.
