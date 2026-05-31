---
"sigil": patch
---

Fix AppImage failing to launch on Linux.

- **Linux:** Fixed `SIGABRT` on startup caused by WebKitGTK being unable to find its subprocess helpers (`WebKitNetworkProcess`, `WebKitWebProcess`). `WEBKIT_EXEC_PATH` and `LD_LIBRARY_PATH` are now set in AppRun so the bundled helpers are found and can load their shared libraries.
- **Linux:** Vault data now persists correctly — bundled WebKitGTK is kept so Tauri's IPC channel matches the compiled version.
- **Linux:** Desktop notifications now work when launched from a file manager — `DBUS_SESSION_BUS_ADDRESS` is set in AppRun before startup.
