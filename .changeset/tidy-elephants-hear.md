---
"glyph": patch
---

- Ship the installed desktop application as **Glyph Wallet**, including the window, tray, launcher, broker lookup, and release title, while preserving the existing application identifier and `glyph://` links.
- Refresh macOS, Windows, Linux, iOS, Android, and AppX icon assets from the new Glyph Wallet icon.
- Harden the Tauri desktop boundary with explicit command capabilities, native-validated callback delivery, session-seed limits, and enforced Rust formatting and linting in CI.
