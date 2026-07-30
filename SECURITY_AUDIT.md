# Security Audit Report

Date: 2026-07-30
Branch: `security/comprehensive-hardening`
Base: `origin/main` at `31d997a`

## Scope

The review covered:

- Rust vault crypto, session retention, biometric storage, auto-lock, clipboard, metadata encryption, callback networking, deep-link parsing, and packaged protocol broker
- React request parsing, dApp approvals, persistence hydration, worker signing, URL delivery, and Tauri capability grants
- JavaScript and Rust dependency graphs
- GitHub Actions CI, release dispatch, release channels, draft assets, native signing, updater manifests, and repository provenance
- Public RustSec, GitHub Security Advisory, and dependency advisory data available on the audit date

The audit used independent read-only reviewers for native, renderer, deep-link, supply-chain, and post-fix adversarial review.

## Fixed findings

### Native and cryptographic boundaries

- Disabled the unsupported Linux biometric path that previously returned successful authentication without user presence.
- Disabled password-backed biometric quick unlock on all platforms until credentials can be hardware-bound. A successful password unlock removes the vault's legacy biometric credential.
- Native idle, sleep, and forced lock paths now clear native session seeds synchronously before emitting the renderer lock event.
- Native auto-lock can no longer be disabled through a zero timeout. Values are constrained to 1 minute through 24 hours, including persisted migrations.
- Vault decryption rejects PBKDF2 iteration counts above 2,000,000 before running the KDF, preventing attacker-controlled CPU exhaustion.
- Metadata key files are created atomically with restrictive permissions. Reads reject symlinks, non-files, and group/world-accessible Unix permissions.
- Linux retains a restrictive durability copy because Secret Service backends can be session-scoped.

### dApp request and callback delivery

- Callback and redirect endpoints must use credential-free HTTPS and match the request's claimed dApp origin exactly.
- The UI labels custom-protocol dApp identity as unverified instead of presenting self-asserted metadata as trusted identity.
- Callback delivery rejects private, loopback, link-local, multicast, documentation, benchmarking, CGNAT, reserved, and IPv4-mapped IPv6 address literals.
- DNS results are checked and pinned into the reqwest client used for the connection, closing the previous preflight/re-resolution rebinding race.
- Production localhost HTTP callbacks are no longer accepted.
- Redirect result construction now preserves existing query parameters and URL fragments.
- Renderer request validation rejects localhost/private literals, cross-origin delivery, negative or fractional contract-call amounts, and non-positive transfer amounts.
- Native contract-call amount validation now rejects negative and non-integer values.

### Renderer and persistence

- Signing workers are single-use and terminate after every response or error, reducing the lifetime of worker heap copies of seed material.
- Privileged Tauri capabilities are limited to the main window. Wildcard notification-window labels no longer inherit store, updater, filesystem, opener, clipboard, and deep-link permissions.
- Password attempt counters, lockout timestamps, and export signing keys are restored through the persisted-state boundary instead of silently resetting during hydration.

### Dependencies, releases, and updates

- Patched both RustSec quick-xml denial-of-service paths. The constrained Windows notification crate is minimally vendored with quick-xml 0.41, and wayland-scanner is pinned to an immutable audited upstream backport commit.
- RustSec reports no known vulnerabilities in the resulting lockfile. It still reports inherited unmaintained GTK3 ecosystem packages and one glib unsoundness advisory through Tauri's current Linux stack.
- Confirmed the resolved React Router version is 8.3.0, which is outside the affected range for GHSA-qwww-vcr4-c8h2.
- Confirmed Tauri resolves to a version patched for CVE-2026-42184. The project does not include the vulnerable Tauri shell plugin.
- Release channel selection now derives from the release tag, not the workflow dispatch ref.
- Release tags must point to commits reachable from the expected `main` or `prerelease` branch.
- Release jobs no longer request unnecessary `actions: write` permission.
- Stable macOS and Windows releases now fail when native signing or notarization credentials are absent. Unsigned native artifacts remain limited to prerelease testing.
- The production updater and security-advisory links now use the canonical `glyphq/wallet` repository.

### Readiness and onboarding

- Corrected README claims about PBKDF2, renderer signing copies, biometric support, repository URLs, updater behavior, and MIT licensing.
- Added `CONTRIBUTING.md` with pinned prerequisites, required checks, secret-handling rules, security boundaries, dependency policy, and protocol-handler review guidance.
- Added `bun run audit:security` for repeatable JavaScript audit, RustSec audit, and locked Rust dependency checking.

## Validation performed

- `bun run check`
- `bun run build`
- `bun run release:check`
- `cargo check --manifest-path src-tauri/Cargo.toml --locked`
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`
- `bun audit --audit-level=high`
- `cargo audit` 0.22.2 against `src-tauri/Cargo.lock`
- dependency-tree verification that only quick-xml 0.41 remains
- diff whitespace checks and secret-pattern scan
- independent post-fix review, followed by fixes for every issue it raised
- static review of Windows/Linux protocol broker registration in addition to in-app parser tests

## Residual risks and follow-up

### Native signing boundary

Transaction and message signing now execute in Rust through narrow `sign_transaction` and `sign_message` commands. The seed-returning command and renderer signing-worker path were removed. Compatibility tests pin the Qubic SDK's seed-to-key derivation, identity encoding, SchnorrQ message signature, serialized transfer, base64 payload, and transaction hash byte-for-byte.

Vault decryption and initial session hydration still originate in the trusted main WebView, so this change removes repeatable seed retrieval during signing rather than claiming that seed material can never exist in renderer memory. A future defense-in-depth phase can move vault decryption and account derivation entirely behind native commands.

### Linux Tauri stack

RustSec reports unmaintained GTK3 bindings and `RUSTSEC-2024-0429` through Tauri/WebKitGTK. No direct application code uses the affected iterator API. Tauri 2.11.5, Tao 0.36, and Wry 0.56 still depend on the GTK3/glib 0.18 stack. Eliminating it is blocked on the unreleased GTK4/WebKit6 migrations tracked upstream in tauri-apps/tauri#14684, tauri-apps/wry#1767, and tauri-apps/tao#1258. The audit script keeps these warnings explicit and fails on unapproved advisories.

### Platform validation

Linux compilation, tests, frontend production build, audits, and static packaged-handler review passed. CI now checks the locked Rust graph on Linux, macOS, and Windows using the repository's Rust 1.88 policy. Native packaging, Authenticode, and notarization remain release-run validations rather than pull-request GUI tests.

### Release governance

Release jobs generate GitHub artifact provenance attestations and uploads refuse to replace mismatched draft assets or mutate published releases. Signed Git tag enforcement, repository tag protection, and branch rules still require repository-level policy and signing-key decisions outside the source tree.
