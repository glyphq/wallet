# Sigil

Premium self-custodial Qubic wallet for desktop.

Sigil gives Qubic users a native place to hold keys, review requests, approve transactions, and manage multiple vaults without moving their signing flow into a browser extension.

Built with Tauri, React, TypeScript, and Rust.

---

## Why Sigil

Most wallet UX on desktop still feels adapted from the browser.
Sigil is built the other way around:

- local-first key custody
- native request review for dApps and tools
- strong lock, clipboard, and callback controls
- desktop-grade flows for history, notifications, exports, and recovery

The result is a wallet that feels closer to a serious desktop app than a thin wrapper around web flows.

---

## Current Product Surface

### Vaults and Accounts

- Encrypted seeded vaults
- Watch-only vaults for tracking without seeds
- Multiple accounts per vault
- Per-account notes and tags
- Vault import and export
- Seed reveal with additional security controls

### Wallet Operations

- Send, receive, burn, and send-to-many
- CSV / JSON recipient import for batch sends
- Full transaction history with memos
- Fiat-at-time price snapshots in history
- Vault analytics for flow, counterparties, contract usage, and monthly summaries
- Global search across accounts, contacts, tx hashes, memos, and known contracts

### dApp and Request Flow

- Native `sigil://` protocol support
- Request review for `transfer`, `sc_call`, `sign_message`, `verify_message`, and `connect`
- Shared request schema and validation path across native intake and renderer
- Decoded previews for common Qubic contract calls
- Request history with callback status
- Callback recovery with retry, save-as-file, and copy-JSON options
- Signed request trust verification with local trusted issuer registry

### Security and Trust

- AES-256-GCM encrypted vault data
- Encrypted persisted app metadata
- Unlocked signing material kept in volatile runtime session only
- Auto-lock on idle, sleep, and optional blur
- Clipboard auto-clear for sensitive values
- Optional password re-check for burn
- Optional biometric gate for seed reveal
- High-value send confirmation threshold
- Local audit log for unlocks, exports, seed reveals, and request approvals
- Signed export format with verification and version handling

### Desktop Experience

- Tray support
- Desktop notifications with inbox history and filters
- Granular polling profiles for active, background, tray-hidden, and locked modes
- Contacts, address suggestions, and recent recipient assistance
- Diagnostics screen and redacted debug bundle export
- Multiple visual themes, font pairs, accents, and custom schemes

---

## Security Model

Sigil is designed so encrypted data stays on disk, while active signing material stays out of persisted state.

- Vault contents are encrypted before they are written to disk.
- Persisted wallet metadata is stored separately and encrypted locally.
- Unlocked session material is held only in volatile runtime memory and cleared on lock.
- Sensitive operations such as callback posting, deep-link validation, replay protection, lock timers, and clipboard clearing are enforced in Rust.
- Update payloads are verified against the embedded updater signing key before install.

Sigil does not rely on a Sigil backend to custody keys or sign on your behalf.

---

## Deep-Link Model

Sigil accepts `sigil://` request URLs and processes them through a native queue plus a shared frontend parser.

At a high level:

1. A dApp creates a request envelope.
2. The envelope is encoded into a `sigil://` deep link.
3. Native Rust receives the URL, validates it, applies nonce replay checks, and queues it.
4. The renderer drains the queue, parses the same payload through the shared schema, and shows the request for approval.

### Current Request Types

- `transfer`
- `sc_call`
- `sign_message`
- `verify_message`
- `connect`

### Validation and Trust

Current validation includes:

- HTTPS-only dApp origins
- localhost-only HTTP callback exceptions for local development
- callback host validation and private-address rejection
- bounded request and callback sizes
- replay protection via request nonce tracking
- signed envelope verification when a trusted issuer is configured

Unsigned requests can still be reviewed, but Sigil treats dApp metadata as unverified unless the request signature matches a trusted issuer in the local registry.

### Callback Handling

If a callback URL is present, Sigil posts the result from native Rust after approval or rejection.
If callback delivery fails, the result stays recoverable in request history for retry, export, or copy.

---

## Updater Notes

Sigil ships signed desktop updates, but platform behavior matters:

- Windows uses the built-in updater flow.
- macOS uses the built-in updater flow.
- Linux auto-update currently targets the AppImage install path.
- `deb` and `rpm` installs should be updated through the package the user installed from until Linux package updater support is expanded.

---

## Main Screens

- Vaults
- Dashboard
- Send / Send to Many
- History
- Stake
- Request Review
- Notifications
- Security
- Trust
- Network
- Appearance
- Contacts
- Diagnostics
- Support

---

## Build Locally

### Requirements

- [Rust stable](https://rustup.rs/)
- [Bun](https://bun.sh/)
- platform prerequisites from the [Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)

### Commands

```sh
git clone https://github.com/sigil-oss/sigil.app
cd sigil.app
bun install
bun tauri dev
bun tauri build
```

Production bundles are emitted under `src-tauri/target/release/bundle/`.

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Desktop shell | Tauri v2 |
| Frontend | React 19 + TypeScript |
| Local state | Zustand |
| Async state | TanStack Query |
| Native layer | Rust |
| Qubic SDK | `@qubic.org/{crypto,tx,wallet,rpc,contracts,types}` |

---

## Community

- GitHub: https://github.com/sigil-oss/sigil.app
- Discord: https://discord.gg/s5qNRNGu96

---

## License

See the repository license and source history for current terms.
