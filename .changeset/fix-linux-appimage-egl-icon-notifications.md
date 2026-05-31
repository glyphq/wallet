---
"sigil": patch
---

Fix Linux AppImage: EGL crash, missing taskbar icon, and broken notifications.

- **Linux:** Fixed hard abort on startup (`Could not create default EGL display: EGL_BAD_PARAMETER`) — WebKitGTK 2.40+ introduced a DMA-BUF renderer that attempts to create an EGL display before the apprun-hooks can set `GDK_BACKEND=x11`. `WEBKIT_DISABLE_DMABUF_RENDERER=1` is now set in AppRun to disable that path.
- **Linux:** Fixed missing taskbar and window icon — the AppRun now installs icons at both 256×256 and 128×128 into the hicolor theme and calls `gtk-update-icon-cache` after registration. Without the cache update the icon index is stale and the WM cannot find the icon.
- **Linux:** Fixed desktop notifications not appearing — `notify-rust` looks up the app icon by name from the hicolor cache; the missing cache update was causing notification daemons (GNOME, KDE) to silently drop or misidentify toasts. Added a fallback D-Bus socket path for non-systemd systems.
- **Linux:** Fixed missing AppImage file icon in file managers — `.DirIcon` is now embedded at the squashfs root during the patch pipeline. Nautilus, Dolphin, and AppImageLauncher read this file to display the icon on the AppImage itself.
