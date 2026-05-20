---
"sigil": patch
---

CI caching improvements and platform build fixes.

**Fixes**
- Windows build: `CRED_FLAGS` is a newtype wrapper in the `windows` crate — changed `Flags: 0` to `Flags: CRED_FLAGS(0)` in `biometric.rs` to satisfy the type checker
- macOS build: removed `toolchain: stable` input from `dtolnay/rust-toolchain` action — when both the action input and `rust-toolchain.toml` are present they conflict, causing `rustup target add` to install targets into the wrong toolchain version so `x86_64-apple-darwin` was missing at build time; the action now reads exclusively from `rust-toolchain.toml`
- Pinned Rust toolchain to `1.88.0` via `rust-toolchain.toml` so sccache artifacts are not invalidated on every Rust stable release (~6 weeks)
- Stabilized sccache GHA cache keys per platform (`sccache-linux-*`, `sccache-macos-*`, `sccache-windows-*`) with fallback to `main` branch cache so release builds reliably restore prior compilation artifacts
- Added `save-always: true` to `swatinem/rust-cache` so the cargo registry cache is preserved even when a build fails partway through
- Added `updater:allow-check` and `updater:allow-download-and-install` permissions to Tauri ACL capabilities — the updater plugin was wired up but blocked by missing ACL grants, causing `[Command plugin:updater|check not allowed by ACL]` in settings
