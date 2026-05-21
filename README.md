# Sigil

Self-custodial Qubic wallet with native dApp deep linking. Desktop-first — Windows, macOS, Linux.

---

## Features

**Wallet**
- Multiple encrypted vaults, each with a password and multiple accounts
- Send, receive, and full transaction history with filters
- Send to up to 25 recipients in one transaction (QUtil)
- Burn QU permanently (QUtil)
- Qearn staking — lock and unlock positions directly from the wallet
- Address book with one-click send
- Transaction memos — attach private notes to any transaction, exportable as JSON
- Privacy mode — hides all balances across every screen
- USD value estimates using live market price, with an optional per-session price override

**Security**
- Seeds and keys never leave your device — no telemetry, no server, no cloud
- AES-256-GCM encryption with PBKDF2 (600,000 iterations)
- Biometric unlock — Windows Hello / Touch ID / macOS Secure Enclave via OS credential store
- Auto-lock on idle, OS sleep, or window blur (Rust-side timer, not renderer)
- Auto-updates enforced on launch — signed packages only, unsigned or tampered releases are rejected

**dApp integration**
- Native deep link protocol (`sigil://`) for web apps and CLI tools to request signatures
- Supports `transfer`, `sc_call`, `sign_message`, and `connect` request types
- Per-dApp permission management with revocation

**Desktop**
- System tray — hide to tray on close, restore with a click, Quit from the tray menu
- Desktop notifications for incoming, outgoing, and confirmed transactions
- Single-instance — opening a second instance focuses the existing window

---

## Security model

Seeds and derived wallets live only in JS memory (Zustand session store). On lock, the session store is cleared. The disk store holds only the AES-256-GCM encrypted blob — the password never persists anywhere. Auto-lock fires from a Rust timer so a frozen renderer cannot bypass it.

Updates are signed with a Tauri signing key. The public key is embedded in the bundle — Sigil verifies the signature before installing anything.

---

## dApp deep linking

Any web app or CLI tool opens a `sigil://v1/request?d=<payload>&cb=<callback>` URI. Sigil:

1. Parses and validates the payload in Rust before the renderer sees it
2. Focuses the existing window (or launches if not running)
3. Shows a review screen — dApp name, origin, what will be signed, which account signs
4. On approval: builds and broadcasts the transaction, POSTs the signed result to the callback URL
5. On rejection: POSTs `{ status: "rejected" }` to the callback URL

---

## Build locally

**Requirements**

- [Rust](https://rustup.rs/) stable toolchain
- [Bun](https://bun.sh/) or Node.js ≥ 20
- Platform prerequisites from [Tauri's guide](https://v2.tauri.app/start/prerequisites/) — WebView2 on Windows, webkit2gtk on Linux

```sh
git clone https://github.com/sigil-oss/sigil.app
cd sigil.app
bun install
bun tauri dev       # hot-reload dev build
bun tauri build     # production installer → src-tauri/target/release/bundle/
```

---

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Tauri v2 (Rust + WebView) |
| Frontend | React 19 + TypeScript (strict) |
| Routing | React Router v7 |
| State | Zustand — persisted to disk via `tauri-plugin-store`, session in-memory |
| Server state | TanStack Query v5 |
| Qubic SDK | `@qubic.org/{types,crypto,tx,wallet,rpc,contracts}` |
| Design | Nothing Design aesthetic — OLED black, Space Grotesk + Space Mono |

---

## Implementation notes

**Biometric unlock** — Settings → Security → enable biometric. Sigil verifies your vault password once, then stores it in the OS credential store (Windows Credential Manager / macOS Keychain / libsecret). Subsequent unlocks retrieve it via the OS biometric prompt. The password is never stored on disk by Sigil itself.

**Auto-updates** — On every launch a splash screen checks for a new release. If one is found, it downloads and installs silently in the foreground (progress bar shown) then relaunches. There is no way to skip an update. Packages are verified against an embedded public key before install.

**QUtil fee** — SendToManyV1 charges a per-invocation fee queried from the contract before signing. The UI blocks the Sign button until the fee resolves and adds it to the transaction amount automatically.

**Transaction history** — SC calls are identified by destination address and shown as `SC CALL` with the contract name (QUtil / Qearn). Pending SC calls carry a `contractName` set at broadcast time. History supports infinite scroll, direction/type/date range/amount/tick filters, and compact amount formatting (1K / 1M / 1B).

**Qearn positions** — The unlock tab scans the last 52 epochs using `getUserLockStatus` (bitmask) followed by parallel `getUserLockedInfo` calls. Positions not yet matured show an `[EARLY]` badge with a warning that rewards may be forfeited.

**SC call destinations** — Contract addresses are derived via `contractIndexToIdentity(index)`. All SC calls pass an explicit destination — the default `SC_DESTINATION` (`'A'.repeat(60)`) from the wallet SDK has an invalid checksum and is never used.

**Bob node (experimental)** — An optional Bob indexer can be configured in Network settings for real-time tick/balance/transfer data via WebSocket. Due to the production CSP, the Bob node must run on `localhost`.
