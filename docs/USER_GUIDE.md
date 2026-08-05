# Glyph User Guide

Glyph is a self-custody desktop wallet for the Qubic network. It runs as a Tauri application on Windows, macOS, and Linux. This guide explains the behavior of the current implementation, including security boundaries and limitations that are easy to misunderstand.

> **Self-custody warning:** Glyph cannot recover your seed or reset a forgotten vault password. Keep an offline backup of every seed. Test backups before relying on them.

## 1. What Glyph stores and what it does not

Glyph stores wallet vaults and application settings on the computer where it is installed. It connects directly to configured Qubic RPC services. Glyph does not upload your seed or password to a Glyph account or recovery service.

A vault can contain up to 16 accounts. Each account is backed by a 55-character lowercase Qubic seed.

Glyph stores two broad kinds of information:

- **Encrypted secrets:** account seeds inside password-encrypted vault data.
- **Local wallet metadata:** names, contacts, transaction memos, scheduled-transfer templates, notification history, audit events, approved dApps, and settings.

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
- The tray icon depends on the desktop's AppIndicator support. Glyph still opens if a tray cannot be created.
- On GNOME, an AppIndicator extension may be required to display the tray icon.
- AppImage bundles much of the GTK/WebKit stack but still uses the host graphics stack. Driver and compositor differences can affect rendering.
- Glyph detects WSLg and disables WebKit compositing and DMABUF there to avoid known rendering failures.

## 3. First launch

On first launch, choose one of these paths:

1. Create a new vault and seed.
2. Import an existing 55-character Qubic seed.
3. Import a Glyph vault export in JSON format.

### Create a new vault

1. Enter a vault name.
2. Glyph generates a 55-character lowercase seed.
3. Write the seed down offline in the exact order shown.
4. Confirm the seed by entering it again.
5. Acknowledge that Glyph cannot recover it.
6. Choose and confirm a vault password.

The setup screen automatically hides the displayed seed after 30 seconds. If you copy it, Glyph schedules the clipboard to be cleared after 60 seconds.

New-vault passwords must contain at least 10 characters and pass the screen's minimum strength check. A longer unique passphrase is strongly recommended.

### Import a seed

An imported Qubic seed must be exactly 55 lowercase letters. After validating the seed, choose the vault name and password.

Importing a seed does not discover or import local Glyph metadata from another installation. Contacts, memos, settings, and audit history are installation-local.

### Import a Glyph vault export

Select a `.json` export and enter the password that encrypted the exported vault. If the file contains more than 16 accounts, Glyph requires you to select no more than 16 before importing.

Current exports use a versioned envelope with a local HMAC integrity value:

- On the installation that created the export, Glyph can detect accidental modification or tampering using its local export-integrity key.
- Another Glyph installation does not have that local key. It can import the file, but reports that its integrity cannot be verified locally.
- The HMAC is not a public signature and does not prove who created the file.
- Legacy unsigned export files remain importable.

The original vault password is still required to decrypt and migrate the selected accounts.

## 4. Vaults and accounts

### Unlock a vault

Enter the vault password on the lock screen. Glyph rate-limits repeated failures:

- After five failed attempts, unlocking is blocked for 30 seconds.
- The failed-attempt count and temporary lockout survive an application restart.
- A successful unlock resets the counter.

Glyph decrypts the vault through native Rust code. During unlock, the seeds briefly cross the Tauri IPC boundary so the renderer can derive account identities, after which the native process retains the active session seeds for signing. See [Security model](#15-security-model-and-important-boundaries) for the exact limitation.

### Switch vaults

Open the vault list, select another vault, and enter that vault's password. Each vault has an independent password and account set.

### Add an account

A vault can contain up to 16 accounts. You can:

- Generate another Qubic seed.
- Import an existing 55-character lowercase seed.

Adding an account requires the current vault password. Back up every newly generated seed immediately. A backup of the first account does not recover later accounts.

### Manage account metadata

Glyph supports account names, notes, tags, visibility, and removal. Hiding an account removes it from normal visible-account lists but does not delete its encrypted seed.

Removing an account requires the vault password. Confirm that its seed is backed up first.

### Reveal a seed

Seed reveal requires the vault password under the normal configuration. The reveal dialog closes automatically after 60 seconds, and a copied seed is scheduled for clipboard clearing after 60 seconds.

Biometric commands are currently disabled on every platform. Leave **Require biometrics for seed reveal** turned off. Enabling that setting can prevent seed reveal because no hardware-backed biometric credential can currently be enrolled.

### Change the vault password

Open the vault detail screen, supply the current password, and choose a new one. The current password-change screen accepts a new password of at least 8 characters. This is less strict than the 10-character onboarding rule, so use a longer unique passphrase even when the screen permits less.

Changing a password re-encrypts the vault. It does not change account seeds or identities.

### Export a vault

Vault export requires the current vault password. Store the resulting JSON file as sensitive material because it contains the encrypted vault and account metadata.

Recommended handling:

1. Save it to encrypted offline storage.
2. Keep the password separately.
3. Test import on a trusted installation.
4. Do not treat the local integrity HMAC as proof of authorship.

### Delete a vault

Deleting a vault requires its password and removes the local encrypted vault record. If another vault exists, Glyph selects it and returns to a locked state. Deleting the last vault returns Glyph to setup.

Deletion is irreversible without a seed backup or a usable encrypted export and its password.

## 5. Dashboard and balances

The dashboard shows visible accounts, aggregate QU balance, recent activity, and assets returned by the configured RPC service.

Important distinctions:

- Qubic balances and transaction status come from the network.
- Asset entries are currently read-only.
- The portfolio view aggregates account QU balances. It is not a full token accounting or cost-basis system.
- Fiat values use current or locally sampled price data and are estimates.

Use the hide-balances setting when sharing a screen. On the receive screen, this setting also obscures the QR code until it is intentionally revealed by hover or tap.

## 6. Sending QU

### Standard transfer

1. Select the source account.
2. Enter or select a checksum-valid Qubic identity.
3. Enter a positive whole-number QU amount.
4. Review the estimated target tick.
5. Sign and broadcast the transaction.

The target tick is calculated from the current tick plus the configured offset. The default offset is 10, with common choices of 5, 10, 15, 20, 30, or 50.

Glyph signs transactions in native Rust and submits them to the configured live RPC. It records a local pending transaction and reconciles it against archive and event data.

Glyph prevents another outgoing transaction from the same identity while one is still pending. A pending record can later become confirmed, failed, or expired.

### Amount and fiat entry

The amount must be a positive integer in QU. The send screen can display or accept a USD estimate when price data is available. That conversion is only an estimate. The signed transaction contains QU, not fiat currency.

### Memos

A memo is saved locally after broadcast. It is not embedded in a standard Qubic transfer and is not visible to the recipient or network. Memos are installation-local and limited to 500 stored entries.

If a send fails, the current draft can remain in volatile session state. Do not rely on drafts as a durable payment record.

### Finality and verification

A broadcast response is not the same as final confirmation. Keep Glyph open or reopen it later so history can reconcile the transaction. For important transfers, verify the transaction independently using a trusted explorer or archive source.

## 7. Send Many

Send Many creates one QUtil `SendToMany` smart-contract transaction for up to 25 recipients.

Glyph fetches the current contract fee, then checks that:

`recipient total + contract fee <= source balance`

You can paste rows or import CSV or JSON.

### CSV format

Use these columns:

```text
identity,amount,label
```

The first two columns are required. A header row is optional.

### JSON format

Provide an array of objects. Recipient aliases include `identity`, `address`, `recipient`, or `to`. Amount aliases include `amount`, `qu`, or `value`. `label` or `name` is optional.

Example:

```json
[
  { "identity": "<QUBIC_IDENTITY>", "amount": 1000, "label": "Supplier A" },
  { "to": "<QUBIC_IDENTITY>", "qu": 2500, "name": "Supplier B" }
]
```

Imports discard invalid rows and use no more than the first 25 valid recipients. Review every row and the fee before signing. The resulting operation is a smart-contract call, not 25 independently signed standard transfers.

## 8. Burn and staking

### Burn QU

The burn screen calls the QUtil `BurnQubic` smart contract. Burning is irreversible. Verify the amount, source account, target tick, and fee before approving.

A security setting can require the vault password before a burn. This setting is off by default.

### QEarn staking

Glyph supports QEarn lock and unlock operations.

- Minimum lock amount: 10,000,000 QU
- Lock period: 52 epochs
- Early unlock is available, but can reduce rewards

Positions and rewards are loaded from network data. A submitted lock or unlock remains subject to Qubic confirmation and contract behavior. Glyph prevents a conflicting outgoing transaction from the same identity while an operation is pending.

## 9. Scheduled transfers

The Scheduled screen stores local transfer templates with a source, destination, amount, interval, and enabled state.

**Scheduled transfers are not automatically signed or sent.** The current implementation does not run a background executor and does not advance the next-run date after an automatic payment. Use **Send now** to open the normal send flow, review the transfer, and approve it manually.

Treat the schedule as a reminder and template, not as a standing payment instruction.

## 10. Receiving and payment links

### Receive screen

Select an account to display its identity and QR code. Confirm the displayed identity before sharing it.

### Create a payment link

Glyph can create:

- A web link such as `https://wallet.glyphq.org/pay?...`
- A deep link such as `glyph://pay?to=...&amount=...&label=...`

A payment link pre-fills a send form. It does not authorize, sign, or broadcast a transaction. The payer must still unlock the wallet, review the request, and approve it.

Copied payment links are not automatically removed from the clipboard.

## 11. Transaction history, analytics, and search

### History

History combines archive transactions, recent event data, and local pending records. It supports filtering by direction, transaction type, amount, date, and tick.

The first archive page can be supplemented with recent event logs to reduce indexing gaps. Results are deduplicated locally. Network or archive delays can still cause temporary omissions or status differences.

Local retention limits include:

- 50 pending transaction records
- 500 transaction memos
- 2,000 price snapshots

Historical fiat values use the nearest locally stored price sample. They are estimates, not exchange receipts or tax records.

### Analytics

Analytics examines visible accounts and can load up to 2,000 transactions per identity. It summarizes net flow, sent and received totals, average values, monthly activity, counterparties, contracts, and recent weekly activity.

Analytics is informational only. It is not accounting, tax, or compliance software.

### Search

Global search covers accounts, contacts, known contracts, and a limited set of archive transactions per account. Search results depend on the configured RPC services and local metadata.

## 12. Contacts and local records

Contacts can contain a name, Qubic identity, note, and tags. They are stored locally. The current UI does not provide contact import or export.

Other local records include:

- Audit log, limited to 500 entries
- Request history, limited to 200 entries
- Notifications, limited to 200 entries
- Scheduled-transfer templates, limited to 50 entries
- Runtime diagnostics, limited to 100 issues

The audit log records selected wallet events such as unlock success or failure, seed reveal, vault export, and external request decisions. It is clearable local history, not an immutable security ledger.

## 13. Notifications and tray behavior

Desktop notifications are disabled by default. When enabled, Glyph requests operating-system permission on the first delivery attempt.

Settings include notifications for received, sent, confirmed, missed, and locked events. Notification records can still be stored in the application even when a desktop popup is suppressed. By default, desktop notifications are suppressed while the wallet is locked unless the locked-notification option allows them.

At startup, Glyph can reconcile received transactions over a lookback of up to 24 hours. Reconciled events are normally stored without replaying old desktop popups.

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

## 14. External requests and `glyph://` links

Glyph recognizes two public deep-link routes:

- `glyph://pay?...` for payment prefill
- `glyph://v1/request?...` for structured dApp requests

Windows and Linux protocol launches pass through a small broker that validates the URL shape before starting the wallet. The wallet then performs full semantic validation.

### Request types

Structured requests can ask Glyph to:

- Transfer QU
- Call a smart contract
- Sign a message
- Verify a message
- Connect a dApp and record selected permissions

Every actionable request requires manual review. A stored dApp approval does not grant silent transaction or signing access. It records the chosen origin, account scope, and permissions for management and display.

### Request safety rules

Current validation includes:

- HTTPS dApp origins without embedded credentials
- HTTPS callbacks and redirects with the same origin as the requesting dApp
- Rejection of local, private, link-local, and other non-global callback destinations
- Request expiry no more than one hour in the future
- A persisted nonce replay window of one hour
- Qubic identity, amount, contract, and payload validation
- A maximum queue of 16 pending requests and 16 pending payment links

The nonce is consumed when Glyph accepts a request for review. Closing or rejecting the request means the same nonce cannot be retried for one hour.

Requests received while locked are queued and presented after unlock. If a queue is full, the oldest queued item is dropped.

### Callback and redirect behavior

After approval, Glyph can:

- POST a small JSON result to a validated HTTPS callback
- Open a validated HTTPS redirect with an encoded result
- Let you copy the result when no callback is supplied or delivery fails

Callback POSTs have a 4 KiB response limit, a 10-second timeout, no redirects, DNS address validation, and connection pinning to a validated address. Review the displayed dApp origin and action even when these controls pass.

## 15. Security model and important boundaries

### Vault encryption

Vault seeds are encrypted in native Rust using:

- AES-256-GCM authenticated encryption
- PBKDF2-HMAC-SHA256 password derivation
- 600,000 PBKDF2 iterations for newly encrypted vaults
- A random 32-byte salt
- A random 12-byte AES-GCM nonce

Glyph accepts a bounded range of iteration counts and older salt sizes when decrypting compatible vaults.

### Application-store encryption

Persisted application values are encrypted with AES-256-GCM under a random installation-specific key. The key is kept in the operating system credential store when available, with a local file fallback.

- Windows: Windows Credential Manager, with an application-data file fallback
- macOS: Keychain through the system keyring, with a local data-file fallback
- Linux: Secret Service through the system keyring when available, plus a durable `0600` local key copy by design

On Unix, fallback key directories and files use restrictive permissions. Windows fallback-file permissions are inherited from the user's application-data environment rather than explicitly tightened by Glyph.

This protects data at rest from casual file inspection. It does not protect an unlocked user session from malware running with the same user privileges.

### Renderer and native process boundary

Long-lived active seeds are retained in zeroizing native Rust memory and transaction or message signing is performed natively. Lock clears the native seed session before the renderer receives the lock event.

However, the seed is not guaranteed to remain exclusively native for its entire lifecycle. During vault creation, unlock, account changes, and seed reveal, seed values briefly exist in the web renderer and cross Tauri IPC. JavaScript strings cannot be deterministically zeroized. Glyph's design reduces long-lived renderer exposure but does not eliminate transient renderer exposure.

### Signing controls

Native signing validates identities, amounts, target ticks, and payload sizes. Signing operations share a process-level rate limit of one operation every 750 milliseconds.

A valid password or unlocked session is not protection against a fully compromised local machine. Verify transaction details before approval and keep the operating system updated.

### Automatic locking

The default inactivity timeout is 15 minutes. Available UI choices are 1, 5, 15, 30, and 60 minutes. Activity such as mouse movement, typing, clicking, scrolling, and touch movement resets the timer.

Additional controls:

- **Lock on sleep:** enabled by default and detects a significant wall-clock jump.
- **Lock on window blur:** disabled by default. It operates in packaged builds and is intentionally disabled during development.

### Clipboard clearing

Identity copies use the configured clipboard timeout, which defaults to 30 seconds and can be set to 15, 30, 60, or never. Seed copies use a fixed 60-second timeout.

Glyph's scheduled clear overwrites the whole clipboard when the timer fires. It does not verify that the clipboard still contains the value Glyph originally copied. If you copy something else before the timer expires, that newer content can also be cleared.

### Biometrics

Biometric enrollment, unlock, and seed reveal commands currently return unavailable on all platforms. Platform-specific scaffolding exists, but Glyph does not enable it until hardware-bound credential handling is complete.

### Recovery boundary

Glyph has no password reset, seed escrow, or remote recovery. Recovery requires one of:

- The original 55-character seed for each account
- A usable Glyph encrypted export and its password

An encrypted export without its password is not a recovery method.

## 16. Network settings

Glyph uses separate live and archive RPC endpoints. The Network settings screen allows custom HTTPS endpoints to be tested before saving. It also controls the target-tick offset.

Use trusted endpoints. A malicious or unreliable RPC can provide false balances, incomplete history, stale ticks, or failed broadcasts. It cannot produce a valid signature without the seed, but it can mislead the information shown before signing.

Default polling intervals vary by application state, with slower polling in the background, tray, and locked states. Asset refreshes are limited to no more than once every 30 seconds.

## 17. Updates

Glyph checks for an update once at startup. Update metadata and packages are verified using Tauri's signed-update mechanism and the public key embedded in the application.

- Windows NSIS, macOS application, and Linux AppImage builds support the integrated updater.
- Debian and RPM packages must be upgraded through the relevant package workflow.

Only install Glyph from a source you trust. Verify published release information before replacing a wallet installation.

## 18. Diagnostics and support

The diagnostics screen can export a JSON report containing information such as:

- Application and updater state
- Content Security Policy information
- Recent runtime issues
- Recent audit events
- Configured network URLs and request statistics
- Counts of local records
- Most application settings

The report excludes vault encrypted data, seeds, and passwords, but it can contain privacy-sensitive metadata such as RPC URLs, dApp origins, account-scope identities, recent security-event descriptions, and configuration choices. Inspect the file before sharing it.

Support links open in the system browser. Treat unsolicited support messages, seed requests, and remote-access requests as scams.

## 19. Practical safety checklist

Before receiving significant funds:

1. Back up every 55-character seed offline.
2. Re-enter or otherwise verify the backup.
3. Use a unique, long vault password.
4. Store an encrypted vault export separately from its password.
5. Test the receive identity through a second trusted channel.

Before signing:

1. Verify the source account and available balance.
2. Verify the complete recipient identity.
3. Confirm the QU amount, contract action, fee, and target tick.
4. Treat payment links and dApp requests as untrusted input.
5. Remember that local memos and labels are not on-chain instructions.

Before sharing diagnostics or exports:

1. Confirm which file you selected.
2. Inspect diagnostics for metadata you do not want to disclose.
3. Never share a seed.
4. Treat an encrypted vault export as sensitive even when you believe its password is strong.
