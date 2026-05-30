---
"sigil": patch
---

Fix AppImage failing to launch on systems without FUSE.

- **Linux:** The AppImage now correctly runs without FUSE by switching to the go-appimage build toolchain, which embeds a FUSE-free runtime. The previous build used an incompatible runtime that caused a silent exit with no visual feedback.
