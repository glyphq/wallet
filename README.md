# Sigil

Self-custodial Qubic wallet for desktop. Native deep-link signing, encrypted local storage, and a desktop-first workflow for Windows, macOS, and Linux.

---

## What Sigil Is

Sigil is a local wallet for Qubic users who want:

- self-custody without a browser extension
- native desktop request review for dApps and tools
- multiple vaults and multiple accounts per vault
- strong local lock, unlock, and clipboard safety defaults

Sigil is built with Tauri, React, TypeScript, and Rust.

---

## Current Highlights

### Wallet

- Multiple encrypted vaults, each with multiple accounts
- Send, receive, and full transaction history
- Send to many recipients in one transaction
- Burn QU directly from the wallet
- Qearn lock and unlock flows
- Private transaction memos
- Contacts with import and export
- Native save dialogs for vault and contact exports

### Security

- Vault data encrypted with AES-256-GCM and PBKDF2
- Persisted app metadata encrypted locally
- Unlocked signing material kept only in a volatile in-memory session and cleared on lock
- Auto-lock on idle, sleep, and optional window blur
- Clipboard auto-clear for sensitive copies
- Signed app updates

### Desktop UX

- System tray support
- Desktop notifications
- Multiple appearance presets and custom schemes
- Privacy mode for hiding balances
- Native quick unlock on Linux secure storage, and biometric unlock on supported platforms

### Deep-Link Requests

- Native `sigil://` protocol support
- Request review for `transfer`, `sc_call`, `sign_message`, `verify_message`, and `connect`
- Callback posting from Rust instead of the webview
- Queueing for incoming requests instead of replacing the active review

---

## Security Model

Sigil is designed so that your encrypted vault stays on disk, while unlocked signing material stays out of persisted app state.

- Vault contents are encrypted before they are written to disk.
- Persisted wallet metadata is stored separately from the vault and is also encrypted locally.
- Unlocked session material is held only in a volatile runtime session and is wiped when the wallet locks.
- Sensitive operations such as callback posting, lock timers, clipboard clearing, and deep-link validation are enforced in Rust.
- Update packages are verified against an embedded signing key before install.

Sigil does not depend on a Sigil backend to hold your keys or sign for you.

---

## Deep-Link Overview

Sigil accepts request URIs in this format:

```text
sigil://v1/request?d=<base64url-payload>&cb=<callback-url>
```

- `d` is required and contains the request JSON as base64url
- `cb` is optional
- callback URLs must use `https://`, except `http://localhost` or `http://127.0.0.1` for local development

Supported request types:

- `transfer`
- `sc_call`
- `sign_message`
- `verify_message`
- `connect`

Shared request fields:

```json
{
  "type": "transfer | sc_call | sign_message | verify_message | connect",
  "nonce": "unique-request-id",
  "exp": 1735689600,
  "dapp": {
    "name": "Example App",
    "origin": "https://example.app"
  }
}
```

Current validation behavior includes:

- HTTPS-only `dapp.origin`
- nonce replay protection
- request expiry checks
- callback host validation
- bounded request size
- bounded message-signing payload size

If a callback URL is provided, Sigil posts the result back from native Rust after approval or rejection. If no callback is provided, the result stays visible in the app for copy/paste.

---

## Main Screens and Flows

### Vaults

- Create or import multiple vaults
- Add, hide, unhide, rename, and remove accounts inside each vault
- Export encrypted vault backups
- Reveal a single account seed with password confirmation

### Transactions

- Standard send flow
- Send-to-many flow
- Burn flow
- Transaction history with filters and memos

### Staking

- Lock QU into Qearn
- Inspect unlockable positions
- Unlock existing positions

### Settings

- Security and lock behavior
- Network endpoint configuration
- Notifications
- Appearance customization
- Contacts import/export
- Support and sponsor view

---

## Build Locally

### Requirements

- [Rust stable](https://rustup.rs/)
- [Bun](https://bun.sh/)
- Platform prerequisites from the [Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)

### Commands

```sh
git clone https://github.com/sigil-oss/sigil.app
cd sigil.app
bun install
bun tauri dev
bun tauri build
```

Production bundles are created under `src-tauri/target/release/bundle/`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 19 + TypeScript |
| Local state | Zustand |
| Async/server state | TanStack Query |
| Qubic SDK | `@qubic.org/{crypto,tx,wallet,rpc,contracts,types}` |
| Native layer | Rust |

---

## Project Notes

- Sigil is desktop-first and intentionally does not behave like a browser extension wallet.
- Request approval is explicit and in-app.
- Contract destinations are derived explicitly; the wallet does not rely on a hardcoded smart-contract placeholder address.
- Sponsor-name metadata is bundled locally instead of fetched from a broad external CDN at runtime.

---

## Community

- GitHub: https://github.com/sigil-oss/sigil.app
- Discord: https://discord.gg/s5qNRNGu96

---

## License

See the repository license and source history for the current terms.
