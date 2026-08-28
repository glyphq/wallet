# Security Policy

## Supported versions

Only the latest published stable release receives routine security fixes. Older releases are not normally backported. Prereleases may receive fixes on a best-effort basis but are not a supported substitute for the latest stable release.

| Release | Support |
|---|---|
| Latest stable | Supported |
| Older stable releases | Not supported |
| Prereleases | Best effort |

## Reporting a vulnerability

**Do not open a public issue, discussion, or pull request for an undisclosed vulnerability.**

Submit the report privately through GitHub [Security Advisories](https://github.com/glyphq/wallet/security/advisories/new). This is the project's published private reporting channel. If the form is temporarily unavailable, do not send vulnerability details through a public issue, discussion, pull request, or chat; retry the private advisory channel before disclosing technical details.

Include as much of the following as possible:

- affected Glyph version, operating system, and package type
- a clear description of the vulnerability and expected impact
- required user interaction and attacker prerequisites
- reproducible steps or a proof of concept using test-only data
- relevant logs with secrets and personal data removed
- known mitigations or workarounds

Never include a real seed, password, vault export, signing key, certificate, updater credential, or production account in a report.

We aim to acknowledge a report within 48 hours and provide an initial assessment or resolution plan within 7 days. Timing may vary with complexity, but maintainers will coordinate disclosure before publishing details that could put users at risk.

## Scope

### In scope

- seed or private-key disclosure, persistence, or exfiltration
- vault encryption, password, or protected-store bypass
- signing without the required user authorization or with a different account or payload than reviewed
- session material surviving lock, reset, or final-vault removal unexpectedly
- dApp permission or account-scope escalation
- `glyph://` argument injection, parsing, replay, spoofing, queue, callback, or redirect flaws
- callback server-side request forgery or DNS-rebinding bypass
- unsafe Tauri command or plugin exposure from the webview
- CSP bypass that enables untrusted script execution
- clipboard, updater-signature, release-asset, package-signing, or publication integrity failures
- exploitable vulnerabilities in direct dependencies or in Glyph's use of an upstream component

### Generally out of scope

- physical access to a device while Glyph is already unlocked
- compromise of the operating system, firmware, browser, keyboard, or screen-capture stack
- social engineering without a software vulnerability
- unsupported older releases
- denial of service without meaningful security impact
- theoretical issues without a reproducible attack path
- an upstream vulnerability with no demonstrated impact on Glyph

Report upstream-only Tauri vulnerabilities to [Tauri Security](https://tauri.app/security/). If Glyph's configuration or integration makes an upstream issue exploitable in Glyph, report the Glyph impact privately to this project as well.

## Current security architecture

Glyph is a Tauri v2 desktop application. The React renderer runs in a platform webview without Node.js APIs. Native access is limited to configured Tauri plugins, the capability allowlist in `src-tauri/capabilities/default.json`, and Rust commands registered in `src-tauri/src/lib.rs`.

The webview is trusted application code, not a separate authorization principal. CSP, input validation, capability scoping, and native command checks reduce attack surface, but a renderer compromise must still be treated as security-sensitive.

### Vault encryption and unlock

Vault payloads are encrypted in Rust with AES-256-GCM. Password-derived keys use PBKDF2-HMAC-SHA-256. New vaults use 600,000 iterations, a random 32-byte salt, and a random 12-byte nonce. Decryption rejects unsupported versions, malformed fields, iteration counts below 100,000, and iteration counts above 2,000,000.

Encryption and decryption are native operations, but passwords and decrypted seed values cross the Tauri command boundary during vault creation, unlock, mutation, and explicit seed reveal. Those values therefore exist briefly in renderer and IPC-managed memory. JavaScript memory does not provide deterministic erasure guarantees.

### Unlocked session and signing

The long-lived unlocked seed set is retained in Rust process state as zeroizing byte buffers. Replacing or clearing the session drops those buffers through `zeroize`-backed storage. Native idle, sleep, and forced-lock paths clear the session before notifying the renderer.

In the normal application flow, the renderer shows the transaction or message for user review and then sends an account index plus transaction or message fields to the registered signing commands. The native commands validate the supplied account index, amount, destination, payload size, message size, and signing rate, but they do not bind the request to a separate native approval record. A future-tick relationship is checked only when the renderer supplies `current_tick`. Seed material is not returned to the renderer for signing.

Transaction and message signing are implemented in Rust, but the current Qubic implementation uses general-purpose big-integer arithmetic and secret-dependent control flow. It has not been established as constant-time and should not be described as resistant to local timing or microarchitectural side channels.

Memory erasure remains best effort at the process level. Temporary values may be copied by language runtimes, serializers, operating-system facilities, or third-party code. Locking reduces secret lifetime but cannot defend a process that is already compromised.

### Biometric state

Password-backed biometric quick unlock and biometric seed reveal are currently disabled until credentials can be bound to suitable hardware-backed storage. Platform capability detection may still be present, but the disabled commands must not be described as an active protection.

### Deep links and dApp identity

Windows and Linux operating-system `glyph://` launches first pass through a minimal broker. The broker accepts one bounded supported URL, rejects malformed or command-like arguments, and starts Glyph without a shell. The main process validates launch input again. macOS uses the native deep-link integration and the same in-app validation path.

Native request handling bounds routes and payloads, maintains a one-hour nonce replay window, and limits pending queues. Renderer schemas validate request types, fields, expiry, HTTPS dApp origins, and callback or redirect origin matching before review.

A custom-protocol request can claim a dApp name and HTTPS origin, but it cannot cryptographically prove which website initiated the launch. The UI must continue to present that identity as unverified. Matching callbacks and redirects to the same claimed origin constrains delivery; it does not verify the claimant.

### Callback delivery

Native callback POSTs:

- require HTTPS
- reject localhost, private, link-local, documentation, multicast, unspecified, and other non-global addresses
- resolve the host before connecting and pin the accepted address for that request
- disable redirects
- cap the request body at 4 KiB
- use a 10-second timeout
- return sanitized network errors

The request schema also requires the callback origin to match the request's claimed dApp origin.

### Auto-lock and clipboard

A native watcher enforces bounded inactivity timeouts and optional sleep locking. Renderer activity resets the timer, and window-blur locking is coordinated by the renderer. Protected clipboard writes have a bounded clear timer; lock handling clears clipboard content when a protected clear is pending.

These controls reduce exposure but cannot prevent another process with operating-system clipboard access from reading content before it is cleared.

### Content security and network access

Production configuration loads bundled scripts from the application itself and does not enable `eval`. Inline styles are allowed by the current CSP. The renderer may connect to HTTPS endpoints, while native updater and callback clients operate outside the webview CSP under their own validation rules.

Do not describe CSP as proof that remote-code execution is impossible. It is one layer in a defense-in-depth model.

### Updates and releases

Built-in updater payloads for Windows, macOS, and Linux AppImage are signed with the Tauri updater key. Stable macOS releases require code signing and notarization credentials, and stable Windows releases require Authenticode signing credentials. Linux deb and rpm installations update through their package path rather than the built-in updater.

The release workflow builds against an existing annotated tag, uploads assets only to a draft release, validates the complete asset set, verifies updater signatures and checksums, and publishes only after validation succeeds. GitHub build-provenance attestations are generated, but current publication validation does not independently verify those attestations.

Release scripts refuse to move existing tags or mutate published assets, but source code alone cannot enforce repository tag protection, branch rules, or maintainer access control. The workflow currently requires annotated tags, not cryptographically signed or GitHub-verified tags. Operational repository controls remain part of the release security boundary.

## Researcher source map

- Tauri initialization and registered commands: `src-tauri/src/lib.rs`
- Capability allowlist: `src-tauri/capabilities/default.json`
- CSP and updater configuration: `src-tauri/tauri.conf.json`
- Vault cryptography: `src-tauri/src/vault_crypto.rs`
- Protected-store cryptography: `src-tauri/src/store_crypto.rs`
- Native session and signing commands: `src-tauri/src/session_crypto.rs`
- Qubic signing implementation: `src-tauri/src/qubic_native.rs`
- Auto-lock enforcement: `src-tauri/src/auto_lock.rs`
- Clipboard clearing: `src-tauri/src/clipboard.rs`
- Deep-link state and validation: `src-tauri/src/deep_link.rs`
- Operating-system link broker: `src-tauri/src/link_broker.rs`
- Callback client: `src-tauri/src/commands.rs`
- Renderer request schemas: `src/lib/request-schema.ts`
- Renderer/native session bridge: `src/lib/secure-session.ts`
- Release workflow: `.github/workflows/release.yml`

## Automated checks

For code changes, CI runs frontend checks, locked Rust checks on Linux, macOS, and Windows, JavaScript dependency auditing at high severity, and RustSec auditing. Automated analysis supplements review and testing; it does not prove that a build or release is vulnerability-free.
