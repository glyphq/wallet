# Glyph Architecture

This document describes the current Glyph desktop-wallet implementation for engineers, maintainers, and security reviewers. It focuses on runtime boundaries, state ownership, cryptography, network flows, platform integration, and known limitations.

Glyph is a Tauri 2 desktop application. The user interface is a React and TypeScript renderer. Privileged operations, wallet cryptography, active-session seed retention, Qubic signing, deep-link validation, secure-store encryption, auto-lock enforcement, and platform integration are implemented in Rust.

## 1. Design goals

The implementation is designed to:

- Provide a self-custody Qubic wallet without a Glyph-hosted seed or password service.
- Encrypt wallet seeds with a user-supplied password.
- Encrypt persisted application metadata with an installation-specific key.
- Keep the long-lived unlocked signing session in native memory.
- Sign Qubic transactions and messages in native Rust.
- Require explicit UI review for transfers, smart-contract calls, and dApp requests.
- Limit Tauri capabilities to the required window surfaces and desktop functions.
- Validate untrusted protocol links before they become wallet actions.
- Support signed application updates on supported package formats.

## 2. Explicit non-goals and limitations

The current design does not provide:

- Password reset, seed escrow, cloud recovery, or a Glyph user account
- Hardware-wallet integration
- Enabled biometric unlock or biometric seed reveal
- A browser extension or mobile runtime
- Automatic execution of scheduled transfers
- Silent dApp transaction approval based on a stored connection
- Deterministic zeroization of seed strings while they transiently exist in JavaScript
- Protection against malware with the same privileges as an unlocked desktop user
- Trustless balances, price data, or history when the configured Glyph API is malicious
- Automatic updates for Debian or RPM installations

## 3. Runtime topology

```mermaid
graph LR
    User[User] --> UI[React renderer]
    Link[Browser or OS glyph link] --> Broker[Link broker on Windows and Linux]
    Broker --> Native[Tauri Rust process]
    Link --> Native
    UI <-->|Tauri IPC and events| Native
    UI <-->|HTTPS| API[Glyph API]
    API <-->|Qubic peer protocol| Peers[Qubic peers]
    Native -->|HTTPS callback POST| DApp[dApp callback]
    Native -->|Open HTTPS redirect| Browser[System browser]
    Native --> Notification[Always-on-top notification window]
    Native --> OS[Credential store, clipboard, tray, filesystem]
    Native --> Store[Local Tauri stores]
    Native --> Updater[Signed update endpoint]
```

The Glyph API is the only chain-data backend in the wallet path. It indexes Qubic data and exposes live peer passthrough; the renderer never calls Qubic RPC services directly. The native process communicates with operating-system facilities, the update service, and validated dApp callback destinations.

## 4. Repository structure

### Frontend

- `src/main.tsx`: main-window renderer entry point
- `src/notification-main.tsx`: separate notification-window entry point
- `src/App.tsx`: application composition and startup behavior
- `src/router.tsx`: hash-based route tree
- `src/screens/`: feature screens for setup, wallets, sends, multisig, history, settings, requests, and support
- `src/layouts/`: application shell and animated route layouts
- `src/components/`: reusable UI, full-screen flows, and request-review components
- `src/hooks/`: Glyph API queries, polling, auto-lock integration, deep links, notifications, and updater hooks
- `src/lib/`: wallet domain logic, generated API client, request validation, export format, session adapters, notification copy, and formatting
- `src/store/`: persisted, session, streaming tick, updater, and UI state
- `src/styles/`: global application styles

### Native application

- `src-tauri/src/app/`: builder, plugins, window lifecycle, tray, setup, and the notification window backend
- `src-tauri/src/commands/`: command-facing validation and orchestration
- `src-tauri/src/wallet_crypto.rs`: password-based wallet encryption and decryption
- `src-tauri/src/store_crypto.rs`: installation-key management and persisted-value encryption
- `src-tauri/src/session_crypto.rs`: native unlocked-session seed storage and native seed copy
- `src-tauri/src/qubic_native.rs`: identity derivation, transaction construction, and native signing
- `src-tauri/src/auto_lock.rs`: native inactivity and sleep-lock state
- `src-tauri/src/clipboard.rs`: scheduled clipboard clearing
- `src-tauri/src/deep_link.rs`: request decoding, semantic validation, replay protection, callback delivery, and redirects
- `src-tauri/src/link_broker.rs`: public URL pre-validation shared by the broker and application
- `src-tauri/src/bin/glyph-link-broker.rs`: sidecar protocol-launch executable
- `src-tauri/src/biometric.rs`: platform scaffolding not exposed as an enabled feature

### Build and delivery

- `src-tauri/tauri.conf.json`: application, bundle, CSP, window, updater, and sidecar configuration
- `src-tauri/capabilities/default.json`: main-window Tauri capability policy
- `scripts/`: versioning, broker preparation, release validation, asset upload, and security audit scripts
- `.github/workflows/`: checks, versioning, release builds, and immutable asset publication

## 5. Frontend composition

The renderer uses:

- React 19
- TypeScript with strict checking
- Vite 7
- React Router 8 with a hash router
- Zustand 5 for application state
- TanStack Query 5 for network-derived state and caching
- Tailwind CSS 4 integration for styling

### Route classes

The route tree separates:

- Setup and import
- Lock and unlock
- Dashboard and wallet management
- Standard send, multisig vaults, and scheduled templates
- Receive and payment-link creation
- History, transaction detail, and search
- Contacts
- External request review and request history
- Settings, security, audit, network, notifications, diagnostics, appearance, and support

The animated application layout mounts cross-cutting hooks, including auto-lock behavior, around authenticated routes.

### Startup sequence

The splash flow waits for persisted Zustand hydration before choosing the initial route. It enforces a minimum splash duration of approximately 4.8 seconds and exposes a stalled-hydration state after approximately 8 seconds.

The route decision is:

1. No configured wallet: setup.
2. Wallet configured but no active session: lock.
3. Active unlocked session: dashboard.

The updater check is triggered once during startup.

## 6. State ownership

Glyph divides state according to lifetime and sensitivity.

### Persisted Zustand state

Persisted state includes encrypted wallet records and local metadata such as:

- Wallet descriptors and account metadata
- Contacts
- Pending transaction summaries
- Transaction memos
- Scheduled-transfer templates
- Notification and audit history
- Request history
- Price samples and runtime issues
- Application, network, security, and appearance settings

The persisted boundary sanitizes and caps collections before storage. Current important caps are:

| Record | Maximum retained |
| --- | ---: |
| Accounts in one wallet | 16 |
| Pending transactions | 50 |
| Transaction memos | 500 |
| Scheduled templates | 50 |
| Notifications | 200 |
| Audit events | 500 |
| External request history | 200 |
| Price snapshots | 2,000 |
| Runtime issues | 100 |

### Session state

Session state represents the currently selected wallet and non-durable UI workflow state. It includes:

- Lock status
- Derived public account identities and display state
- Current selections
- Volatile send drafts and alerts
- Queued request presentation state

The renderer retains cached public identities when locked so it can continue limited balance polling and notification reconciliation. Identities are public account identifiers, not seeds.

### Native session state

The Rust process owns the long-lived active seed array after unlock. Seeds are stored as zeroizing byte buffers. Native commands reference accounts by index for identity derivation and signing.

Lock clears this native state synchronously before a `glyph:lock` event tells the renderer to clear its unlocked state.

### TanStack Query state

Network-derived balances, tick data, owned assets, transaction history, and related API results live in the query cache. The generated client points at one configured Glyph API origin, and the query cache is cleared when that origin changes so data from another service is never reused. Stream-backed resources load once and are then updated or invalidated by tick, market, and identity feeds.

## 7. Persistent storage architecture

Glyph uses Tauri Store files under the platform application-data location.

### Main application store

The logical application state is stored in `glyph.json`. Values written through Glyph's secure storage adapter use this format:

```text
enc-v1:<base64url(nonce || AES-GCM ciphertext-and-tag)>
```

Encryption properties:

- AES-256-GCM
- Random nonce for each stored value
- One random 256-bit installation key
- Authenticated decryption before JSON deserialization

Older plaintext values are accepted for migration. When the application next saves state, they are rewritten in encrypted form.

### Installation key storage

The store key is cached in the native process after loading or creation.

| Platform | Preferred storage | Fallback or durable copy |
| --- | --- | --- |
| Windows | Windows Credential Manager generic credential | `%APPDATA%/com.qubic.glyph/store-key` |
| macOS | System keyring and Keychain | User data directory file |
| Linux | Secret Service through the system keyring | `~/.local/share/com.qubic.glyph/store-key`, or the XDG equivalent |

On Unix, the local key directory is created with mode `0700` and the key file with mode `0600`. On Linux, the implementation deliberately writes a durable local copy even if Secret Service storage succeeds. On Windows, the fallback file relies on the user's application-data access controls rather than an explicit file ACL configured by Glyph.

This key protects local data at rest but is available to the running application. An attacker who can execute as the same desktop user can potentially access both ciphertext and key material.

### Deep-link replay store

`glyph-security.json` stores accepted request nonces and timestamps. Nonces are not secret. They are retained to enforce the one-hour replay window.

### Export integrity key

Version 2 wallet exports include HMAC-SHA256 over a canonical envelope. The HMAC key is installation-local and persisted through Glyph's protected storage path.

Consequences:

- The originating installation can detect a modified export.
- A different installation cannot verify that local HMAC and imports with an unverified-integrity warning.
- The HMAC is not a portable digital signature, identity proof, or substitute for wallet encryption.
- Legacy unsigned exports are intentionally accepted for compatibility.

## 8. Wallet cryptography

### Encryption format

New wallet encryption uses:

- AES-256-GCM
- PBKDF2-HMAC-SHA256
- 600,000 iterations
- Random 32-byte salt
- Random 12-byte GCM nonce
- Wallet format version 1

The password-derived AES key exists in native code for the encryption or decryption operation and is then dropped. Sensitive Rust buffers use zeroizing containers where practical.

### Compatibility validation

Decryption validates input sizes and resource bounds before deriving a key. It accepts compatible 16-byte or 32-byte salts and PBKDF2 iteration counts from 100,000 through 2,000,000. This supports older data while preventing an imported file from requesting an unbounded derivation cost.

### Password policy location

Password strength rules are UI policy, not cryptographic-format constraints:

- New-wallet setup requires at least 10 characters and the screen's minimum strength level.
- Password rotation uses the same 10-character minimum.

The native wallet format can decrypt any valid password bytes, including legacy wallets whose password predates the current policy.

## 9. Unlock and signing data flow

```mermaid
sequenceDiagram
    participant UI as React renderer
    participant Cmd as Native commands
    participant Wallet as Wallet crypto
    participant Session as Native session
    participant API as Glyph API

    UI->>Cmd: unlock(encrypted wallet, password)
    Cmd->>Wallet: PBKDF2 and AES-GCM decrypt
    Wallet-->>Cmd: seed array
    Cmd-->>UI: seed array over Tauri IPC
    UI->>UI: derive public identities
    UI->>Cmd: store_session_seeds(seed array)
    Cmd->>Session: retain zeroizing seed buffers
    UI->>Cmd: sign transaction(account index, fields)
    Cmd->>Session: read selected seed
    Cmd->>Cmd: validate and sign in Rust
    Cmd-->>UI: signed transaction payload
    UI->>API: broadcast signed transaction
```

### Security interpretation

The architecture reduces seed residence in the renderer after unlock, but it is not a strict native-only secret architecture.

Seeds transiently enter renderer memory during:

- New-account creation
- Wallet import and unlock
- Account addition or removal workflows that re-encrypt the wallet
- Explicit seed reveal

They cross Tauri IPC as serialized command values. JavaScript strings and objects cannot be reliably overwritten. The native session is the long-lived signing location, but the renderer remains inside the sensitive trust boundary whenever a wallet is being manipulated or unlocked.

A compromised renderer in an unlocked session can invoke allowed signing commands with attacker-selected transaction fields. Native validation prevents malformed structures and some abuse, but the review UI is the primary intent-confirmation control.

## 10. Native signing

`qubic_native.rs` implements Qubic identity derivation and signing through the Qubic Rust libraries.

Native commands validate, as applicable:

- Account index exists in the native session
- Recipient identity syntax and checksum
- Signed 64-bit amount parsing and nonnegative constraints
- Target tick is in the future
- Contract and input parameters
- Transaction input payload is no more than 1,024 bytes
- Message input is no more than 64 KiB at the native command boundary

All native transaction and message signing shares a process-level rate limiter of one operation per 750 milliseconds.

The external-request URL envelope imposes smaller practical limits. For example, sign-message request text is limited to 2,048 characters and the encoded request payload is limited to 8,192 base64url characters.

## 11. Locking and session lifecycle

### Native auto-lock

The native auto-lock controller tracks activity and enforces a timeout between 1 and 1,440 minutes. The UI exposes 1, 5, 15, 30, and 60 minutes, with 15 minutes as the default.

Renderer activity events include mouse movement, keyboard input, click, wheel, and touch movement. The auto-lock loop evaluates state every 10 seconds.

### Sleep and blur

Lock-on-sleep is enabled by default. The implementation treats a wall-clock jump greater than 12 seconds as a likely suspend or sleep event.

Lock-on-window-blur is disabled by default. When enabled, it forces a native lock in packaged builds. It is intentionally bypassed during development to avoid locking whenever developer tools or another window gains focus.

### Lock ordering

The native force-lock path:

1. Clears native session seeds.
2. Updates native lock state.
3. Emits `glyph:lock`.
4. Lets the renderer clear unlocked wallets, drafts, and alerts.

This ordering avoids an event window in which the renderer appears locked while native signing secrets remain available.

### Process exit

Normal process termination drops in-memory native session state. The explicit lock path is stronger because it clears the session before the process continues running.

## 12. Clipboard boundary

Clipboard writes are performed through Tauri clipboard integration. Native scheduling tracks whether Glyph has a pending clear operation.

- Identity copies use a configurable 15, 30, or 60 second timeout, or no automatic clear.
- The default is 30 seconds.
- Seed copies use 60 seconds.
- Application close clears a pending Glyph clipboard value.

Native keeps a SHA-256 digest of the value Glyph last copied. Scheduled clears, lock-time clears, and application-close clears blank the clipboard only while it still contains that value. If the clipboard cannot be read, the clear still runs so a copied seed does not remain. Content the user copies after Glyph is left intact.

## 13. API and transaction architecture

### Network clients

The frontend uses a generated Glyph API client for every chain read and broadcast. A custom API origin must use HTTPS and is tested in Network settings before being persisted.

The Glyph API supplies current network state, paginated history, decoded events, typed contract queries, and signed-transaction broadcast. Contract reads are sent as hex input to `/v1/live/contracts/{index}/query`; the typed contract helpers only encode and decode payloads.

### Live streams and fallbacks

The renderer loads each resource once, then follows Glyph SSE feeds:

| Feed | Updates |
| --- | --- |
| `/v1/stream/ticks` | Cached head, epoch, last-processed tick, network health, expiry |
| `/v1/stream?types=price,market` | Price and market-cap cards |
| `/v1/stream?types=transaction,event&identity={id}` | History, balances, assets, received notifications, confirmations |
| `/v1/lifecycle/stream?token={token}` | Per-pending-transaction lifecycle progress and terminal resolution |

The wallet requests a short-lived lifecycle link from `POST /v1/transactions/{hash}/lifecycle/link` for each pending transaction and follows the returned SSE stream. Links are renewed after expiry or a closed connection. A slower lifecycle fetch remains as a fallback when the stream is unavailable.

One shared connection is kept per identity, regardless of how many hooks subscribe. EventSource reconnects automatically; `open`, `lag`, window focus, and network-online events trigger a reconciliation fetch, as does the initial mount. Query caches are updated or invalidated from the stream rather than on a fixed interval. Polling remains for resources with no stream, including the optional custom price feed, external Coinbase exchange rates, and a 15-second wallet-balance fallback. Persisted polling profiles apply to those fallbacks.

Balances and owned assets do not have a dedicated snapshot stream. They load once, poll periodically as a fallback, and are invalidated by identity transaction/event frames and by transaction resolution, with a per-identity throttle so a busy account cannot cause unbounded contract queries.

### Standard transfer flow

1. The renderer validates source, recipient, amount, balance, and pending-transaction guard.
2. It reads the newest indexed or peer head from the API and adds the configured offset, default 10.
3. Native Rust constructs and signs the transaction.
4. The renderer broadcasts it to the Glyph API.
5. A local pending record is retained.
6. The identity transaction stream resolves it to confirmed, failed, or expired; lifecycle is read on connect, reconnect, lag, or focus to cover missed frames.

Only one outgoing pending operation is allowed per source identity. This is an application-level guard, not a Qubic protocol lock.

### History composition

History merges:

- Cursor-paginated identity transactions, 50 per page
- Recent decoded event results for the initial time window
- Local pending records

The first page is loaded from the API. New transactions and contract effects invalidate the active identity's history query; the query no longer polls on a timer. The frontend deduplicates merged results. Event supplementation mainly covers approximately two weeks of recent activity. Archive indexing delays can still produce temporary gaps.

### Confirmation push

Pending transactions are resolved from the shared identity feed, not by polling history. The wallet matches inserted transaction hashes and reads `/v1/transactions/{hash}/lifecycle` for the money-flow verdict. Lifecycle is also read when a stream opens, reconnects, reports `lag`, or when the app becomes visible or online, so a dropped frame or offline window cannot leave a transaction pending forever. Transaction-history queries are invalidated after resolution but are not used as the confirmation mechanism.

The tick feed advances the cached head used by expiry. A pending transaction expires when the streamed tick passes `targetTick + 30`, independent of transaction-stream health.

### Local transaction metadata

Memos are local records keyed to transactions and are not included in a standard on-chain transfer. Historical fiat values use the nearest retained local price sample. Neither should be treated as authoritative network data.

## 14. Smart-contract feature boundaries

### Multisig vaults

Multisig manages MSVault vaults. The wallet can create vaults, read owner and asset state, deposit QU or supported assets, request releases, and collect approvals before signing. Fee and holding-fee information is read from the contract and shown in review. Vault, owner, and asset views link to Glyph Explorer.

### Scheduled transfers

Scheduled transfers are persisted templates only. There is no timer service, native executor, automatic signing, or automatic advancement of `nextRunAt`. The manual action routes to the standard send screen.

## 15. Deep links and dApp requests

### Public protocol surface

The accepted public routes are:

```text
glyph://pay?to=<identity>&amount=<optional>&label=<optional>
glyph://v1/request?d=<base64url-json>&cb=<optional>
```

The request route accepts only `d` and optional `cb` parameters. The pay route accepts only `to`, optional `amount`, and optional `label`.

### Broker boundary

On Windows and Linux, protocol registration invokes the bundled `glyph-link-broker` sidecar rather than passing arbitrary command-line input directly to the main executable.

The broker:

- Accepts exactly one URL argument
- Limits it to 12 KiB
- Rejects control characters, whitespace, quotes, apostrophes, backslashes, and pipe characters
- Rejects duplicate, empty, unknown, or malformed parameters
- Accepts only the two public routes
- Starts a fixed wallet executable next to the broker
- Does not invoke a shell

This is syntactic containment. The main application independently repeats route parsing and performs semantic validation.

### Single-instance behavior

The main application accepts no launch argument or one valid Glyph URL. Subsequent valid protocol launches are forwarded to the existing application instance. Invalid extra arguments are not treated as requests and do not open a new request surface.

### Request envelope

The `d` value is base64url-encoded JSON with a maximum encoded size of 8,192 characters. The native parser accepts either a normalized envelope or a compatible bare request and emits the normalized form to the renderer.

Supported types are:

- `transfer`
- `sc_call`
- `sign_message`
- `verify_message`
- `connect`

### Validation

Native validation includes:

- Nonce length 16 through 128 using a restricted character set
- One-hour nonce replay retention
- Expiry no more than one hour ahead
- HTTPS dApp origin without credentials
- HTTPS callback and redirect URLs
- Callback and redirect origin equality with the dApp origin
- Rejection of loopback, private, link-local, multicast, documentation, and other non-global destinations
- DNS resolution with every resolved address required to be globally routable
- Identity and amount rules per request type
- Message and contract payload bounds

A missing expiry is accepted for validation using an effective five-minute lifetime, but the normalized renderer request does not gain a synthesized `exp` field. As a result, the review UI cannot display a countdown for that compatibility case.

Renderer schema validation and native validation both accept smart-contract indexes 0 through 63. Native validation remains authoritative for request envelopes.

### Queues and replay timing

Pending dApp requests and payment links each use a bounded queue of 16. The oldest item is dropped when a queue is full.

The native layer records a request nonce when the request is accepted for review, before approval. Rejecting or closing the request therefore prevents retry with the same nonce during the one-hour replay window.

Requests received while locked remain queued and are presented after unlock.

### Approval semantics

Every transfer, contract call, message-sign, verify, and connect request requires explicit review. A connection shares the selected account identity and echoes the requested permission labels for protocol compatibility, but the wallet does not store or enforce a permission policy and every later request is reviewed again.

### Result delivery

Approved request results can be:

- POSTed as JSON to a callback
- Encoded into a redirect URL opened in the system browser
- Copied by the user

Callback hardening includes:

- Same-origin validation at ingestion and delivery
- HTTPS only
- All DNS results checked for global routability
- Connection pinned to a validated address
- Redirect following disabled
- 10-second timeout
- 4 KiB maximum response body

Delivery failure is recorded and the UI can retry, save, or copy the result.

## 16. Notifications and background behavior

Notifications are rendered in a separate always-on-top Tauri window, independent of the main wallet. The native layer creates, positions, resizes, and hides that window; the main renderer sends notification events and the overlay renderer owns the visible card stack. The overlay also plays the configured terminal sound for live deliveries, keeps one card per transaction hash, preserves active cards until resolution or dismissal, and updates that card with an animated bottom state bar as lifecycle state changes; replayed pending cards remain silent.

- Notification windows are off by default.
- Position, visible duration, and maximum visible cards are configurable.
- Notification records are capped at 200.
- Locked-state display follows the user's privacy setting, but events can still be persisted.
- Startup reconciliation can examine up to 24 hours of received activity without replaying old notification windows.

If hide-to-tray is enabled, a close request hides the main window. Otherwise, it exits. Tray construction failure is nonfatal.

The autostart plugin manages the operating-system registration only after a user enables **Launch at startup** in Settings. The renderer reconciles the displayed setting with the plugin's current registration state when the Notifications settings screen opens.

## 17. Updater and packaging

Tauri updater configuration embeds a public verification key and points to release `latest.json` metadata. The application checks once at startup.

Integrated updater behavior is supported for:

- Windows NSIS
- macOS application bundles
- Linux AppImage

Debian and RPM packages are system-managed and require package replacement rather than the Tauri update installer.

The Windows updater uses quiet installation. Linux AppImage update handling adjusts temporary-directory behavior so the replacement package remains on a suitable filesystem.

## 18. Tauri capability and web security policy

### Window

The main window is constrained to a desktop-wallet form factor:

- Fixed size: 380 by 680
- Resizing not enabled
- Decorations disabled
- Packaged developer tools disabled
- Maximize and fullscreen not enabled

A separate `notification-overlay` window is created on demand:

- Always on top
- Transparent and undecorated
- Skipped in the taskbar
- Not focusable
- Dynamically sized to the visible notification stack
- Anchored to a configurable screen corner

### Content Security Policy

The packaged CSP permits:

- Default content from `self`
- Scripts from `self`
- Styles from `self` with inline styles allowed
- Fonts from `self` and `data:`
- Images from `self`, `data:`, and `blob:`
- Connections to `self`, Tauri IPC endpoints, and HTTPS

Remote scripts are not permitted by the configured CSP. The HTTPS connection allowance covers the bundled Glyph API, wallet, relay, exchange-rate, and updater origins; dApp callbacks are native.

### Main-window capabilities

The main window receives only the declared Tauri capabilities, including:

- Basic window close and drag operations
- External opener
- Store get, set, load, save, and delete
- Deep-link handling
- Clipboard write
- Notification-window display
- User-controlled startup registration
- Updater check and install
- Save dialog
- File existence and write access scoped to Downloads and Documents

Native application code can access its private application directories independently of renderer filesystem capabilities.

A renderer compromise can exercise these allowed APIs and registered native commands. Capability restriction reduces ambient desktop access but does not make an unlocked compromised renderer safe for wallet signing.

## 19. Platform-specific native behavior

### Windows

- Installation key prefers Windows Credential Manager.
- NSIS uses per-user installation.
- Installer hooks register protocol handling through the broker.
- A data-file key fallback exists if Credential Manager operations fail.

### macOS

- Builds are universal across Apple Silicon and Intel.
- The installation key prefers Keychain through the keyring API.
- Tauri handles the custom URL scheme integration.
- Biometric platform code exists but public commands remain disabled.

### Linux

- Packages include AppImage, Debian, and RPM.
- Protocol integration uses the broker for desktop launches.
- The installation key can use Secret Service and also has a durable mode-`0600` file copy.
- Tray availability depends on StatusNotifierItem desktop support.
- WSLg detection disables WebKit compositing and DMABUF.
- AppImage bundles WebKitGTK and GTK components but depends on host GL and EGL behavior.

## 20. Threat model and trust boundaries

### Protected against

The implementation provides meaningful controls against:

- Offline inspection of wallet ciphertext without the password
- Offline inspection of normal application-store values without the installation key
- Accidental or local modification of an export when verified on its originating installation
- Replayed dApp links within the nonce retention window
- Basic command-line and shell injection through registered protocol links
- Private-network callback targeting and common DNS rebinding paths
- Remote script loading under the packaged CSP
- Unbounded signing calls and oversized native payloads
- Continued native signing after an explicit lock event

### Not protected against

The design does not protect secrets or transaction intent from:

- Malware or an attacker running as the same unlocked operating-system user
- A compromised renderer during an unlocked session
- Screen capture, accessibility capture, or malicious input methods during seed reveal
- Clipboard managers retaining copied values
- A user approving a deceptive but structurally valid request
- A malicious or compromised Glyph API lying about balances, prices, ticks, history, or broadcast success
- Loss of all seeds, exports, and passwords
- Rollback or replacement of the entire local installation by an attacker with sufficient system privileges

### Trust assumptions

Security depends on:

- The integrity of the installed Glyph binary and bundled assets
- Tauri, WebView, Rust, npm, and Qubic dependency integrity
- Operating-system user isolation and credential-store behavior
- The user's ability to review transaction details
- At least one trustworthy source for network verification
- Secure release signing and update-key custody

## 21. Known implementation caveats

Security and architecture reviews should explicitly account for these current behaviors:

1. **Transient renderer seed exposure:** unlock returns seeds over IPC before the native session is populated.
2. **Biometrics disabled:** all public biometric commands return unavailable or an error.
3. **Linux store key has a durable file copy:** Secret Service success does not eliminate the local key file.
4. **Windows fallback ACL is implicit:** the fallback key file does not receive an explicitly configured Glyph ACL.
5. **Scheduled transfers are not executed:** they are reminders and prefill templates.
6. **Connections do not pre-authorize requests:** every action still requires explicit review.
7. **Nonce consumption occurs before approval:** rejected requests cannot reuse the same nonce for one hour.
8. **Missing request expiry is not surfaced to the renderer:** native validation applies a five-minute effective lifetime without adding the field.
9. **Audit history is mutable:** it is local, capped, and clearable.
10. **Diagnostics contain metadata:** reports omit wallet secrets and unique device or network identifiers, but can disclose identities in scopes, origins, endpoints, recent security activity, and non-unique device state.
11. **Network-derived data is trusted for display:** signatures remain local, but malicious API data can influence user decisions.

## 22. Review checklist for sensitive changes

Changes involving wallets, signing, deep links, persistence, or platform integration should verify:

1. What process and state layer owns each secret at every step.
2. Whether a value crosses Tauri IPC or enters JavaScript.
3. Whether native commands treat renderer arguments as untrusted.
4. Whether lock clears native state before UI state changes.
5. Whether persisted collections remain sanitized and bounded.
6. Whether new stores use encrypted-value handling where appropriate.
7. Whether URL validation covers parsing, scheme, credentials, origin, DNS, redirects, sizes, and replay.
8. Whether callback delivery revalidates instead of trusting ingestion-time checks alone.
9. Whether a new Tauri capability is scoped only to the required window and path.
10. Whether a platform package has the same behavior as development mode.
11. Whether release artifacts remain signed and immutable.
12. Whether documentation distinguishes local metadata from on-chain data.
