---
"sigil": patch
---

Biometric persistence fix, focus ring audit, autocomplete off, CI stability.

**Fixes**
- Biometric unlock (Windows): bypassed `keyring` crate entirely on Windows; now uses `CredWriteW`/`CredReadW` directly with `CRED_PERSIST_LOCAL_MACHINE` so credentials survive app restarts. Users who previously enabled biometric must disable and re-enable it once after updating (credential target name changed from `sigil-bio/{uuid}` to `sigil-vault/{uuid}`)
- Focus rings: removed `outline: none` inline suppressors from color swatch buttons, ThemeCard, FontCard, and accent color picker; bare `<input>` elements in send, send-many, and security screens now use `sigil-input` class for consistent border-based focus treatment; `:focus-visible` ring (1px white, 2px offset) now applies globally without suppression
- Autocomplete: `autoComplete="off"` on all text inputs, `"new-password"` on password fields, preventing browser autofill popups from overlapping the UI
- CI (macOS): added explicit `rustup target add aarch64-apple-darwin x86_64-apple-darwin` step; `rust-toolchain.toml` causes `dtolnay/rust-toolchain` to ignore its `targets:` input so the separate step is required for universal builds
- CI (Linux): added `bunfig.toml` with `ignoredDependencies` for `lightningcss-linux-x64-musl` and `lightningcss-linux-arm64-musl` which fail to extract on glibc runners

**Docs**
- Added `TESTING.md` — complete end-to-end manual test guide covering all 18 user-facing flows, regression checklist, platform-specific notes, and test dApp HTML snippet
- Updated `README.md` with auto-updater and biometric unlock sections
