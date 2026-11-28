# Glyph User Guide

Glyph is a self-custody desktop wallet for the Qubic network. It runs as a Tauri application on Windows, macOS, and Linux. This guide explains the behavior of the current implementation, including security boundaries and limitations that are easy to misunderstand.

> **Self-custody warning:** Glyph cannot recover your seed or reset a forgotten wallet password. Keep an offline backup of every seed. Test backups before relying on them.

## 1. What Glyph stores and what it does not

Glyph stores wallets and application settings on the computer where it is installed. It connects to a Glyph API service for chain data. Glyph does not upload your seed or password to a Glyph account or recovery service.

A wallet can contain up to 16 accounts. Each account is backed by a 55-character lowercase Qubic seed.

Glyph stores two broad kinds of information:

- **Encrypted secrets:** account seeds inside password-encrypted wallet data.
- **Local wallet metadata:** names, contacts, transaction memos, scheduled-transfer templates, notification history, audit events, and settings.

Local metadata is encrypted at rest with an installation-specific key when it is written to Glyph's application store. Some records, such as transaction confirmations and balances, are derived again from network data. Other records, such as memos and contacts, exist only on this installation unless separately backed up.

## 2. Supported desktop platforms

Glyph is packaged for:

- Windows as an NSIS installer
- macOS as a universal application bundle
- Linux as AppImage, Debian, and RPM packages

Glyph is not a browser wallet and does not currently provide mobile builds.

### Platform-specific notes

#### Windows

The installer registers the `glyph://` protocol. Links are passed through the bundled Glyph link broker before the wallet processes them.

#### macOS

The universal application supports Apple Silicon and Intel Macs. Protocol links are handled through the Tauri application integration.

#### Linux

- AppImage supports Glyph's built-in update flow.
- Debian and RPM installations must be updated through a newly installed package. The built-in updater does not replace system-managed packages.
- The tray icon uses the desktop's StatusNotifierItem support. Glyph still opens if a tray cannot be created.
- On GNOME, an AppIndicator or KStatusNotifierItem extension may be required to display the tray icon.
- AppImage bundles much of the GTK/WebKit stack but still uses the host graphics stack. Driver and compositor differences can affect rendering.
- The AppImage keeps WebKitGTK compositing enabled and uses its shared-memory DMA-BUF transport by default. If startup or rendering fails, launch it with `GLYPH_WEBKIT_RENDERER=legacy` for the older software path, or `GLYPH_WEBKIT_RENDERER=native` to leave WebKit's own renderer selection untouched. Explicit WebKit renderer environment variables take precedence.
- On Wayland sessions, the AppImage runs through the native Wayland backend instead of XWayland so fractional scaling and window constraints match the compositor. X11 remains a fallback; set `GDK_BACKEND=x11` to force XWayland if native Wayland renders poorly on your driver.
- Fixed-size windows are treated as floating by Niri. Hyprland also floats windows whose maximum size is smaller than a tile.
- Glyph detects WSLg and disables WebKit compositing and DMABUF there to avoid known rendering failures.

## 3. First launch

On first launch, choose one of these paths:

1. Create a new wallet and seed.
2. Import an existing 55-character Qubic seed.
3. Import a Glyph wallet export in JSON format.

### Create a new wallet

1. Enter a wallet name.
2. Glyph generates a 55-character lowercase seed.
3. Write the seed down offline in the exact order shown.
4. Confirm the seed by entering it again.
5. Acknowledge that Glyph cannot recover it.
6. Choose and confirm a wallet password.

The setup screen automatically hides the displayed seed after 30 seconds. If you copy it, Glyph schedules the clipboard to be cleared after 60 seconds.

New-wallet passwords must contain at least 10 characters and pass the screen's minimum strength check. A longer unique passphrase is strongly recommended.

### Import a seed

An imported Qubic seed must be exactly 55 lowercase letters. After validating the seed, choose the wallet name and password.

Importing a seed does not import local metadata from another installation. A Glyph wallet export can include contacts and transaction memos; settings and audit history remain installation-local.

### Import a Glyph wallet export

Select a `.json` export and enter the password that encrypted the exported wallet. If the file contains more than 16 accounts, Glyph requires you to select no more than 16 before importing.

Current exports use a versioned envelope with a local HMAC integrity value:

- On the installation that created the export, Glyph can detect accidental modification or tampering using its local export-integrity key.
- Another Glyph installation does not have that local key. It can import the file, but reports that its integrity cannot be verified locally.
- The HMAC is not a public signature and does not prove who created the file.
- Legacy unsigned export files remain importable.

The original wallet password is still required to decrypt and migrate the selected accounts.

## 4. Wallets and accounts

### Unlock a wallet

Enter the wallet password on the lock screen. Glyph rate-limits repeated failures:

- After five failed attempts, unlocking is blocked for 30 seconds.
- The failed-attempt count and temporary lockout survive an application restart.
- A successful unlock resets the counter.

Glyph decrypts the wallet through native Rust code. During unlock, the seeds briefly cross the Tauri IPC boundary so the renderer can derive account addresses, after which the native process retains the active session seeds for signing. See [Security model](#15-security-model-and-important-boundaries) for the exact limitation.

### Switch wallets

Open the wallet list, select another wallet, and enter that wallet's password. Each wallet has an independent password and account set.

### Add an account

A wallet can contain up to 16 accounts. You can:

- Generate another Qubic seed.
- Import an existing 55-character lowercase seed.

Adding an account requires the current wallet password. Back up every newly generated seed immediately. A backup of the first account does not recover later accounts.

### Manage accounts

Glyph supports account names and removal. Removing an account requires the wallet password. Confirm that its seed is backed up first.

### Copy a seed

Open the account edit screen and hold **Copy seed** for one second. Glyph reads the seed from the unlocked native session without displaying it, verifies that it belongs to the selected account, writes it to the clipboard, and schedules clipboard clearing after 60 seconds. Copying is available only for the active wallet.

### Reveal a seed

Revealing an account seed from the wallet detail screen requires the wallet password under the normal configuration. The reveal view closes automatically after 60 seconds, and a copied seed is scheduled for clipboard clearing after 60 seconds.

Biometric commands are currently disabled on every platform, so the biometric seed-reveal requirement is hidden. When biometric enrollment is available again, the requirement applies only to a wallet that has an enrolled credential; otherwise Glyph falls back to the password path instead of blocking reveal.

### Change the wallet password

Open **Settings → Security** for the active wallet, or the wallet detail screen, supply the current password, and choose a new one. New passwords use the same 10-character minimum as onboarding. A longer unique passphrase is still preferable.

Changing a password re-encrypts the wallet. It does not change account seeds or addresses.

### Export a wallet

Wallet export requires the current wallet password. Store the resulting JSON file as sensitive material because it contains the encrypted wallet, account metadata, and any contacts and transaction memos included in the backup.

Recommended handling:

1. Save it to encrypted offline storage.
2. Keep the password separately.
3. Test import on a trusted installation.
4. Do not treat the local integrity HMAC as proof of authorship.

### Delete a wallet

Deleting a wallet requires its password and removes the local encrypted wallet record. If another wallet exists, Glyph selects it and returns to a locked state. Deleting the last wallet returns Glyph to setup.

Deletion is irreversible without a seed backup or a usable encrypted export and its password.

## 5. Dashboard and balances

The dashboard shows aggregate QU balance, the latest streamed network tick, recent activity, and assets returned by the configured Glyph API service. The header vault action opens multisig.

Important distinctions:

- Qubic balances and transaction status come from the network.
- The tick above the balance is the newest value delivered by the live tick stream.
- Asset entries are read-only.
- The portfolio view aggregates account QU balances. It is not a full token accounting or cost-basis system.
- Fiat values use current or locally sampled price data and are estimates.

Use the hide-balances setting when sharing a screen. On the receive screen, this setting also obscures the QR code until it is intentionally revealed by hover or tap.

## 6. Sending QU

### Standard transfer

1. Select the source account.
2. Enter or select a checksum-valid Qubic address or contact.
3. Enter a positive whole-number QU amount.
4. Review the recipient, amount, remaining balance, and estimated target tick.
5. Sign and broadcast the transaction.

The target tick uses the newest indexed or peer head reported by the Glyph API plus the configured offset. The default offset is 10, with common choices of 5, 10, 15, 20, 30, or 50.

Glyph signs transactions in native Rust and submits them to the configured Glyph API. It records a local pending transaction and reconciles it against archive, lifecycle, and live event data. Balances refresh after broadcast and confirmation, and continue to poll periodically as a fallback.

Glyph prevents another outgoing transaction from the same address while one is still pending. A pending record can later become confirmed, failed, or expired.

### Amount and fiat entry

The amount must be a positive integer in QU. The send screen can display or accept an estimate in the configured display currency when price data is available. That conversion is only an estimate. The signed transaction contains QU, not fiat currency.

Amounts show grouped digits while typing. The review screen shows the resulting balance and offers a refresh action; **Back** returns to the input with the draft intact.

### Memos

A memo is saved locally after broadcast. It is not embedded in a standard Qubic transfer and is not visible to the recipient or network. Memos are installation-local and limited to 500 stored entries.

If a send fails, the current draft can remain in volatile session state. Do not rely on drafts as a durable payment record.

### Finality and verification

A broadcast response is not the same as final confirmation. Keep Glyph open or reopen it later so history can reconcile the transaction. For important transfers, verify the transaction independently using a trusted explorer or archive source.

## 7. Multisig vaults

Open multisig from the vault action in the dashboard header. Glyph supports shared MSVault vaults with up to 16 owners.

- Create a vault by choosing its owners, required approvals, name, and icon.
- Deposit QU or supported assets into the vault.
- Owners can request releases of QU or vault assets.
- Pending releases appear as approvals on the vault screen and in the shared pending-approval list.
- Each approval is reviewed on its own screen before signing.
- Vault, owner, and asset rows link to Glyph Explorer where an explorer URL is available.
- Holding fees and release fees are shown before signing.

Multisig operations are smart-contract calls and remain subject to Qubic confirmation and contract behavior. A submitted operation is tracked like any other pending transaction.

## 8. Scheduled transfers

The Scheduled screen stores local transfer templates with a source, destination, amount, interval, and enabled state.

**Scheduled transfers are not automatically signed or sent.** The current implementation does not run a background executor and does not advance the next-run date after an automatic payment. Use **Send now** to open the normal send flow, review the transfer, and approve it manually.

Treat the schedule as a reminder and template, not as a standing payment instruction.

## 9. Receiving

### Receive screen

Select an account to display its address and QR code. Confirm the displayed address before sharing it.

## 10. Transaction history and search

### History

History combines archive transactions, recent event data, and local pending records. It groups rows by day, shows pending transfers first, and loads older activity as you scroll.

The first archive page can be supplemented with recent event logs to reduce indexing gaps. Results are deduplicated locally. Network or archive delays can still cause temporary omissions or status differences.

Select a row to open transaction detail. The detail screen shows the transaction type, parties, amount, status, tick, fees, explorer links, and a copy action for the transaction ID. Local memos can be added there.

Local retention limits include:

- 50 pending transaction records
- 500 transaction memos
- 2,000 price snapshots

Historical fiat values use the nearest locally stored price sample. They are estimates, not exchange receipts or tax records.

### Search

Global search covers accounts, contacts, known contracts, and a limited set of archive transactions per account. Search results depend on the configured Glyph API service and local metadata.

## 11. Contacts and local records

Contacts can contain a name, Qubic address, and tags. They are stored locally and can be imported or exported as CSV or JSON.

Other local records include:

- Audit log, limited to 500 entries
- Request history, limited to 200 entries
- Notifications, limited to 200 entries
- Scheduled-transfer templates, limited to 50 entries
- Runtime diagnostics, limited to 100 issues

The audit log records selected wallet events such as unlock success or failure, seed reveal, wallet export, and external request decisions. It is clearable local history, not an immutable security ledger.

## 12. Notifications and tray behavior

Notifications use a separate always-on-top Glyph window rather than operating-system notification toasts. The window is independent of the main wallet and shows the Glyph icon, title, and description.

Notifications are disabled by default. In Settings, you can choose:

- Position: top-left, top-right, bottom-left, or bottom-right. The default is bottom-right.
- Visible duration: 4, 6, 8, 10, or 15 seconds. The default is 6 seconds.
- Maximum visible notifications: 2, 3, 4, or 5. The default is 3.
- Sounds: on by default. Choose low, medium, or high volume, and use **Preview** to hear the confirmation sound.
- Sound mapping: sent, received, confirmed, expired, connection requests, and transaction requests use distinct terminal sounds.

Transaction lifecycle updates reuse the same notification card, so sent, confirmed, failed, or expired states do not stack. An active transaction card stays on screen until it resolves or you dismiss it; its bottom progress bar ramps from 30% to 60% before the target tick, holds 60% while confirming, and reaches 100% on confirmation or failure, and its ETA starts from the sign-time tick estimate and is corrected by the live lifecycle stream's observed tick rate. Cards enter from the configured screen corner. Clicking a notification opens its transaction or account in Glyph Explorer when an explorer target is available. Notification records are stored in the application even when the window is disabled or suppressed. By default, notification windows are suppressed while the wallet is locked unless the locked-notification option allows them.

At startup, Glyph can reconcile received transactions over a lookback of up to 24 hours. Reconciled events are normally stored without replaying old notification windows.

### Close and tray

- If **Hide to tray on close** is enabled and a tray is available, closing the window hides Glyph.
- Otherwise, closing exits the application.
- The tray menu can reopen or quit Glyph.
- Missing tray support does not prevent the wallet from opening.

### Launch at startup

- **Launch at startup** registers Glyph with the operating system to open when you sign in.
- The setting is off by default and is available on Windows, macOS, and Linux.
- Turning it off removes Glyph's operating-system startup registration.

Exiting drops the process-held session data. Lock explicitly clears the native signing session before notifying the renderer.

## 13. External requests and `glyph://` links

Glyph recognizes `glyph://v1/request?...` for structured dApp requests.

Windows and Linux protocol launches pass through a small broker that validates the URL shape before starting the wallet. The wallet then performs full semantic validation.

### Request types

Structured requests can ask Glyph to:

- Transfer QU
- Call a smart contract
- Sign a message
- Verify a message
- Connect a dApp after choosing the address to share

Every actionable request requires manual review. A connection shares the selected address; it never grants silent transaction or signing access, and every later request is reviewed again. Requested permission labels are echoed for dApp compatibility but are not used to filter or authorize requests.

### Request safety rules

Current validation includes:

- HTTPS dApp origins without embedded credentials
- HTTPS callbacks and redirects with the same origin as the requesting dApp
- Rejection of local, private, link-local, and other non-global callback destinations
- Request expiry no more than one hour in the future
- A persisted nonce replay window of one hour
- Qubic address, amount, contract, and payload validation
- A maximum queue of 16 pending requests

The nonce is consumed when Glyph accepts a request for review. Closing or rejecting the request means the same nonce cannot be retried for one hour.

Requests received while locked are queued and presented after unlock. If a queue is full, the oldest queued item is dropped.

### Callback and redirect behavior

After approval, Glyph can:

- POST a small JSON result to a validated HTTPS callback
- Open a validated HTTPS redirect with an encoded result
- Let you copy the result when no callback is supplied or delivery fails

Callback POSTs have a 4 KiB response limit, a 10-second timeout, no redirects, DNS address validation, and connection pinning to a validated address. Review the displayed dApp origin and action even when these controls pass.

## 14. Security model and important boundaries

### Wallet encryption

Wallet seeds are encrypted in native Rust using:

- AES-256-GCM authenticated encryption
- PBKDF2-HMAC-SHA256 password derivation
- 600,000 PBKDF2 iterations for newly encrypted wallets
- A random 32-byte salt
- A random 12-byte AES-GCM nonce

Glyph accepts a bounded range of iteration counts and older salt sizes when decrypting compatible wallets.

### Application-store encryption

Persisted application values are encrypted with AES-256-GCM under a random installation-specific key. The key is kept in the operating system credential store when available, with a local file fallback.

- Windows: Windows Credential Manager, with an application-data file fallback
- macOS: Keychain through the system keyring, with a local data-file fallback
- Linux: Secret Service through the system keyring when available, plus a durable `0600` local key copy by design

On Unix, fallback key directories and files use restrictive permissions. Windows fallback-file permissions are inherited from the user's application-data environment rather than explicitly tightened by Glyph.

This protects data at rest from casual file inspection. It does not protect an unlocked user session from malware running with the same user privileges.

### Renderer and native process boundary

Long-lived active seeds are retained in zeroizing native Rust memory and transaction or message signing is performed natively. Lock clears the native seed session before the renderer receives the lock event.

However, the seed is not guaranteed to remain exclusively native for its entire lifecycle. During wallet creation, unlock, account changes, and seed reveal, seed values briefly exist in the web renderer and cross Tauri IPC. JavaScript strings cannot be deterministically zeroized. Glyph's design reduces long-lived renderer exposure but does not eliminate transient renderer exposure. The account **Copy seed** action is handled natively and does not return the seed to the renderer.

### Signing controls

Native signing validates addresses, amounts, target ticks, and payload sizes. Signing operations share a process-level rate limit of one operation every 750 milliseconds.

A valid password or unlocked session is not protection against a fully compromised local machine. Verify transaction details before approval and keep the operating system updated.

### Automatic locking

The default inactivity timeout is 15 minutes. Available UI choices are 1, 5, 15, 30, and 60 minutes. Activity such as mouse movement, typing, clicking, scrolling, and touch movement resets the timer.

Additional controls:

- **Lock on sleep:** enabled by default and detects a significant wall-clock jump.
- **Lock on window blur:** disabled by default. It operates in packaged builds and is intentionally disabled during development.

### Clipboard clearing

Identity copies use the configured clipboard timeout, which defaults to 30 seconds and can be set to 15, 30, 60, or never. Seed copies use a fixed 60-second timeout.

Glyph stores a digest of the value it copied. Scheduled, lock-time, and application-close clears blank the clipboard only while it still contains that value, so content copied afterwards is preserved. If Glyph cannot read the clipboard, it clears anyway so a copied seed does not remain.

### Biometrics

Biometric enrollment, unlock, and seed reveal commands currently return unavailable on all platforms. Platform-specific scaffolding exists, but Glyph does not enable it until hardware-bound credential handling is complete.

### Recovery boundary

Glyph has no password reset, seed escrow, or remote recovery. Recovery requires one of:

- The original 55-character seed for each account
- A usable Glyph encrypted export and its password

An encrypted export without its password is not a recovery method.

## 15. Network settings

Glyph uses a single Glyph API origin for chain data. The Network settings screen allows a custom HTTPS origin to be tested before saving. It also controls the target-tick offset.

Use a trusted Glyph API. A malicious or unreliable service can provide false balances, incomplete history, stale ticks, or report a broadcast that never reached a peer. It cannot produce a valid signature without the seed, but it can mislead the information shown before signing.

Glyph uses live streams for ticks, prices, market data, identity transactions, and confirmation resolution. Wallet balances also poll every 15 seconds as a fallback and refresh after broadcast and transaction resolution. Polling intervals vary by application state, with slower polling in the background, tray, and locked states. Asset refreshes are limited to no more than once every 30 seconds.

## 16. Updates

Glyph checks for an update once at startup. Update metadata and packages are verified using Tauri's signed-update mechanism and the public key embedded in the application.

- Windows NSIS, macOS application, and Linux AppImage builds support the integrated updater.
- Debian and RPM packages must be upgraded through the relevant package workflow.

Only install Glyph from a source you trust. Verify published release information before replacing a wallet installation.

## 17. Diagnostics and support

The diagnostics screen can export a JSON report containing information such as:

- Application and updater state
- Content Security Policy information
- Recent runtime issues
- Recent audit events
- Configured network URLs and request statistics
- Counts of local records
- Most application settings
- Device diagnostics such as battery state, display, available disk space, and connection type

The report excludes wallet encrypted data, seeds, passwords, device identifiers, serial numbers, IP addresses, and MAC addresses. It can still contain privacy-sensitive metadata such as API URLs, dApp origins, account-scope addresses, recent security-event descriptions, and configuration choices. Inspect the file before sharing it.

Support links open in the system browser. Treat unsolicited support messages, seed requests, and remote-access requests as scams.

## 18. Practical safety checklist

Before receiving significant funds:

1. Back up every 55-character seed offline.
2. Re-enter or otherwise verify the backup.
3. Use a unique, long wallet password.
4. Store an encrypted wallet export separately from its password.
5. Test the receive address through a second trusted channel.

Before signing:

1. Verify the source account and available balance.
2. Verify the complete recipient address.
3. Confirm the QU amount, contract action, fee, and target tick.
4. Treat dApp requests as untrusted input.
5. Remember that local memos and labels are not on-chain instructions.

Before sharing diagnostics or exports:

1. Confirm which file you selected.
2. Inspect diagnostics for metadata you do not want to disclose.
3. Never share a seed.
4. Treat an encrypted wallet export as sensitive even when you believe its password is strong.
