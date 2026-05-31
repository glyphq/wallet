---
"sigil": patch
---

Fix AppImage stability and notifications on Linux.

- **Linux:** Vault data now persists correctly — bundled WebKitGTK is kept so Tauri's IPC custom scheme handler matches the compiled version; using the system WebKit caused silent `invoke()` failures that discarded all store writes.
- **Linux:** Desktop notifications now work when the AppImage is launched from a file manager or launcher. The session D-Bus address is set in AppRun before startup — without it, `zbus` can't reach `org.freedesktop.Notifications` and notifications fail silently.
