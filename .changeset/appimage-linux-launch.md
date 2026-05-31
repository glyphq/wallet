---
"sigil": patch
---

Fix AppImage launching on Linux.

- **Linux:** Fixed `SIGABRT` on startup — the custom AppRun was replacing linuxdeploy's wrapper and skipping the `apprun-hooks` that set `GDK_BACKEND`, GTK paths, pixbuf loaders, and GIO modules. AppRun now sources those hooks and delegates to the original launcher binary.
- **Linux:** `WEBKIT_EXEC_PATH` is now set correctly so WebKitGTK can find its subprocess helpers (`WebKitNetworkProcess`, `WebKitWebProcess`).
