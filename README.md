[demo.webm](https://github.com/user-attachments/assets/cc8601bc-fa6a-47dc-83c4-4ff5ec957e3b)


# Sigil

Self-custodial Qubic wallet with native dApp deep linking. Desktop-first — Windows, macOS, Linux.

---

## What it is

Sigil is a desktop wallet for Qubic that keeps your keys on your machine and lets dApps request signatures through a native deep link protocol. Any web app or CLI tool can open a `sigil://` URI — Sigil focuses, shows a review screen, and POSTs the signed result back to a callback URL.

Beyond deep linking, it's a full-featured Qubic wallet:

- Multiple encrypted vaults, each with a password and multiple accounts
- Send, receive, full transaction history
- Send to up to 25 recipients in a single transaction (QUtil)
- Burn QU permanently (QUtil)
- Qearn staking — lock and unlock positions directly from the wallet
- Address book with one-click send
- Auto-lock on idle, OS sleep, or window blur
- Privacy mode — hides all balances across every screen

**Seeds never leave your device. No server ever sees your seed or password.** Everything is encrypted locally with AES-256-GCM + PBKDF2 (600,000 iterations).

---

## Build locally

### Requirements

- [Rust](https://rustup.rs/) (stable toolchain)
- [Bun](https://bun.sh/) or Node.js ≥ 20
- [Tauri CLI v2](https://v2.tauri.app/start/prerequisites/)
- Platform prerequisites per [Tauri's guide](https://v2.tauri.app/start/prerequisites/) (WebView2 on Windows, webkit2gtk on Linux)

### Steps

```sh
git clone https://github.com/alez04/sigil.app
cd sigil.app
bun install
bun tauri dev       # hot-reload dev mode
bun tauri build     # production installer
```

The installer ends up in `src-tauri/target/release/bundle/`.

---

## User flows

### First run

1. Launch → Welcome screen
2. **Create vault**: name → generate seed (write it down) → confirm backup → set password → dashboard
3. **Import vault**: paste existing 55-char seed → name → password → dashboard

### Send QU

Dashboard → **Send** → enter recipient identity or pick from contacts → enter amount → Review (shows from/to/tick, fee: none) → Sign and send.

From the send screen, two secondary options are always visible:
- **Send to Many** — batch up to 25 recipients in one SC transaction
- **Burn QU** — permanently destroy QU (danger-styled, two confirmation steps)

### Send to Many

Send to Many → add recipients (identity + amount per row, contact picker available for each) → running total shown → Review (lists all recipients + QUtil fee + total) → Sign and send.

### Qearn staking

Dashboard → **QEARN →** → two tabs:

- **Lock**: enter amount → review (shows lock epoch and maturity epoch, which is lock + 52) → sign
- **Unlock**: lists all active locked positions queried from chain. Positions not yet matured show an `[EARLY]` badge and a danger-styled button with a warning that rewards may be forfeited. Matured positions show a standard unlock button.

### dApp signing request

A dApp opens `sigil://v1/request?d=<payload>&cb=<callback>`. Sigil:

1. Parses and validates the URI in Rust before the renderer sees anything
2. Focuses the existing window (or launches if closed)
3. Shows a review screen: dApp name, origin, what's being signed, which account will sign
4. On approval: builds and broadcasts the transaction, POSTs the result to the callback URL
5. On rejection: POSTs `{ status: "rejected" }` to the callback URL

Supported request types: `transfer`, `sc_call`, `sign_message`, `connect`.

### Contacts

Contacts → add by name + identity. Clicking a contact row navigates to Send with the identity pre-filled. The send screen also has a contact picker modal ("FROM CONTACTS ↓"). Last-used timestamp updates automatically when a send to that identity completes.

---

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Tauri v2 (Rust backend, WebView frontend) |
| Frontend | React 19 + TypeScript strict |
| Routing | React Router v7 |
| State | Zustand (persisted to disk via tauri-plugin-store, session in-memory) |
| Server state | TanStack Query v5 |
| Qubic SDK | `@qubic.org/types`, `@qubic.org/crypto`, `@qubic.org/tx`, `@qubic.org/wallet`, `@qubic.org/rpc`, `@qubic.org/contracts` |
| Design system | Nothing Design — OLED black, Space Grotesk + Space Mono, mechanical UI |

---

## Important notes

**Security model:** Seeds and derived wallets live only in JS memory (Zustand session store). On lock, the session store is zeroed. The disk store holds only the AES-256-GCM encrypted blob — password never persists. Auto-lock fires in Rust, not the renderer, so a frozen UI doesn't bypass it.

**SC call destinations:** Qubic contract addresses are derived with `contractIndexToIdentity(index)` from `@qubic.org/crypto`. The default `SC_DESTINATION` constant in the wallet SDK (`'A'.repeat(60)`) has an invalid checksum and must not be used — all SC calls in Sigil pass an explicit destination.

**QUtil fee:** SendToManyV1 charges a per-invocation fee queried from the contract before signing. The UI blocks the Sign button until the fee resolves and adds it to the transaction amount automatically.

**Qearn positions:** The unlock tab scans the last 52 epochs using `getUserLockStatus` (bitmask check) followed by parallel `getUserLockedInfo` calls for each epoch. Results are cached for 30 seconds via TanStack Query.

**Transaction history:** SC calls are identified by destination address and shown as `[SC CALL]` with the contract name (QUtil / Qearn), rather than `[SENT]`. Pending SC calls carry a `contractName` field (e.g. `"QUtil · Send to Many"`) set at broadcast time.
