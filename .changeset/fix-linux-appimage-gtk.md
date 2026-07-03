---
"glyph": patch
---

Fix Linux AppImage libgtk errors by keeping GTK/GLib/Cairo/Pango bundled

- Replace cache-apt-pkgs-action with direct apt-get for reliable package installation
- Only strip display/GPU libs (EGL, GL, GBM, DRM) from AppImage, not the entire GTK stack
- Previously stripped GTK3, GLib, Cairo, Pango, HarfBuzz, ATK, GDK-Pixbuf which broke
  the apprun-hooks and caused libgtk errors on most distros
