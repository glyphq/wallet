---
"sigil": patch
---

Fix AppImage failing to launch on Linux.

- **Linux:** The AppImage now runs without FUSE by using the go-appimage toolchain, which embeds a FUSE-free runtime.
- **Linux:** Fixed a startup crash on newer distros caused by a bundled `libmount` version mismatch with the system's `libgio`.
