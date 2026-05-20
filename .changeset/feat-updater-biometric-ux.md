---
"sigil": minor
---

Auto-updater, biometric fix, accessibility, and request UX improvements.

**Features**
- Auto-updater: Settings footer shows available update with version; user-triggered download and install with live progress (`[DOWNLOADING... 42%]`); CI pipeline signs all platform artifacts and publishes `latest.json` updater manifest to GitHub Releases
- Installer branding: window title set to "Sigil", publisher and copyright metadata, per-user NSIS install mode, fullscreen and maximize disabled on Windows
- Accessibility: `aria-label` on all icon-only buttons, `aria-live="polite"` on status/error regions, `aria-hidden` on decorative icons, keyboard-triggered QR code reveal
- Animated seed display: characters appear one by one with a 30 ms stagger on seed generation
- Request popup now slides up as a bottom sheet with a drag handle and backdrop spacer

**Fixes**
- Biometric unlock: changed keyring key format from `"bio:{uuid}"` (colon breaks Windows Credential Manager) to a separate service `"sigil-bio"` with vault ID as username; added verify-after-store step so enable fails loudly instead of silently; split error handling so wrong-password and keyring-failure show distinct messages
- SC call preview: amount row is now shown only when the contract call transfers QU; removed the misleading "Fee: None" row (contract fees are the dApp's responsibility to communicate)
- Transfer and SC call approvals now block when the signer's balance is insufficient (`[INSUFFICIENT BALANCE]`) or a transfer is already pending confirmation (`[TRANSFER PENDING — WAIT FOR CONFIRMATION]`)
- Connect screen copy clarifies that permissions are per-action approvals, not silent background grants
- Appearance settings: increased spacing between sections for visual clarity
- Clipboard watcher: removed dead code path, `should_clear` now called directly in the watcher loop
- CI: release notes sourced from `CHANGELOG.md`; Rust toolchain bumped to 1.88.0 to satisfy updated dependency requirements (`darling`, `icu_*`, `image`, `plist`, `serde_with`, `time`, `zbus`)
