# Tauri end-to-end security smoke path

The repository now has an executable WebDriver path for the native boundaries that cannot be validated in a browser-only test:

```sh
cargo install tauri-driver --locked
bun tauri build --debug
TAURI_E2E_REQUEST_URL='glyph://v2/request?d=<base64url-envelope>' \
TAURI_E2E_PASSWORD='<seeded-profile-password>' \
scripts/tauri-e2e-smoke.sh
```

The harness starts `tauri-driver`, launches the debug wallet, injects the request through the sibling `glyph-link-broker`, and drives the real webview. It requires a disposable profile that already contains one vault and starts locked. The request should use dApp name `Glyph E2E`, or set `TAURI_E2E_DAPP_NAME` to match the fixture.

The scenario is intentionally a rejection flow because it is deterministic and does not need network signing or a funded account:

1. Inject a valid request while the wallet is locked.
2. Unlock and confirm that the queued request reaches the approval screen.
3. Reject it and assert that the callback completion status is rendered.
4. Inject the exact same URL again and assert that the request is not shown a second time.

`TAURI_E2E_REQUEST_URL` must contain a valid native-accepted envelope. If it has a callback, use a disposable HTTPS callback endpoint that is permitted by the native callback policy. A local HTTP callback is intentionally not supported by this smoke path.

## Bundle smoke checks

For extracted or installed payloads, run the portable identity and checksum contract checker:

```sh
node scripts/bundle-smoke.mjs \
  --root /path/to/extracted-root \
  --platform linux \
  --checksums /path/to/SHA256SUMS-linux.txt
```

Use `linux`, `macos`, or `windows` for the platform. Linux checks the installed wallet and broker names, desktop deep-link routing, AppStream identity, and icon. macOS checks `Info.plist` display name, bundle identifier, and executable. Windows checks the installed wallet filename and PE magic. When a checksum manifest is supplied, entries are path-confined, unique, non-empty, and verified against the artifact bytes.

These are standalone checks and are not added to release workflows. They can be run against locally extracted packages or by a platform release operator without changing native implementation, CSP, or workflow files.
