# Contributing to Glyph

Thank you for improving Glyph. This project is a self-custodial desktop wallet, so changes can affect user funds, local secrets, operating-system integration, and release integrity. Keep contributions focused, reviewable, and supported by evidence.

## Before you start

- Search existing issues and pull requests for related work.
- Base your branch on the current target branch. Stable work targets `main`; work intended for the prerelease channel targets `prerelease`.
- Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md).
- Never put real seeds, passwords, vault exports, signing keys, certificates, release credentials, `.env` files, or personal wallet data in source, fixtures, logs, screenshots, issues, or pull requests.

## Development prerequisites

Use the versions pinned by the repository:

- [Bun](https://bun.sh/) `1.3.14`
- Rust `1.88.0` through [rustup](https://rustup.rs/)
- platform dependencies required by Tauri v2
- `cargo-audit` `0.22.2` when running the security audit

Both `rust-toolchain.toml` files pin Rust `1.88.0`. Ensure `cargo` and `rustc` come from rustup rather than an older distribution package.

On Ubuntu or Debian, the development build needs:

```sh
sudo apt update
sudo apt install build-essential libwebkit2gtk-4.1-dev libdbus-1-dev
```

Release packaging has additional platform requirements. See [docs/RELEASING.md](./docs/RELEASING.md) before changing or testing bundle production.

Install the pinned Rust audit tool with:

```sh
cargo install cargo-audit --version 0.22.2 --locked
```

## Set up the repository

```sh
git clone https://github.com/glyphq/wallet.git
cd wallet
bun install --frozen-lockfile
bun tauri dev
```

`bun tauri dev` prepares the development deep-link broker, starts Vite, compiles the Rust application, and opens the desktop window. For frontend-only work, `bun run dev` starts Vite without the native shell.

Commit both lockfiles when their dependency graphs change:

- `bun.lock`
- `src-tauri/Cargo.lock`

## Repository map

- `src/`: React application, screens, state, request schemas, and shared UI
- `src/styles/`: design tokens and global interaction styles
- `src-tauri/src/`: Rust commands, vault and store cryptography, native signing, locking, clipboard handling, deep links, and callbacks
- `src-tauri/capabilities/`: renderer capability allowlist
- `src-tauri/tauri.conf.json`: window, CSP, bundle, protocol, and updater configuration
- `scripts/`: versioning, audit, packaging, validation, and release helpers
- `.github/workflows/`: CI, Changesets, prerelease artifact, and release automation
- `.changeset/`: release-note inputs and Changesets configuration

## How to make a change

1. Keep the branch scoped to one coherent outcome.
2. Add or update tests for behavior changes and regressions.
3. Preserve failure, retry, locked, empty, and partially loaded states.
4. Keep persisted data migrations backward compatible and persisted collections bounded.
5. Reuse shared components and tokens instead of adding route-specific copies.
6. Update documentation when behavior, security boundaries, setup, or operations change.
7. Add a Changeset when the change belongs in release notes.

See [DESIGN.md](./DESIGN.md) for interface rules and [.changeset/README.md](./.changeset/README.md) for Changeset policy.

## Validation

Run the checks that apply to the change and list them in the pull request.

### Baseline checks

```sh
bun run check
bun run build
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo check --manifest-path src-tauri/Cargo.toml --locked
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo test --manifest-path src-tauri/Cargo.toml --locked
```

`bun run check` runs TypeScript checking and the Bun test suite. `bun run build` performs a TypeScript build followed by a production Vite build.

### Release and workflow changes

```sh
bun run release:check
```

This verifies that `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the root package entry in `src-tauri/Cargo.lock` have the same version. It also syntax-checks release scripts and lints GitHub Actions workflows. The script downloads a checksum-verified `actionlint`; it uses `shellcheck` when that command is installed, and CI installs it explicitly.

### Dependency or security-sensitive changes

```sh
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' bun run audit:security
```

This runs the JavaScript audit at high severity, the RustSec audit, and a locked Rust check. It requires `cargo-audit` `0.22.2`. The `TAURI_CONFIG` override lets the direct Rust checks work before `bun tauri dev` or `bun tauri build` has generated the required link-broker sidecar; see [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for details and PowerShell equivalents.

If a check cannot run on your platform, say exactly which check was skipped and why. Do not describe an untested packaging path as verified.

## Security review triggers

Request explicit security review and targeted regression coverage for changes involving:

- vault encryption, decryption, passwords, exports, or migrations
- seed creation, reveal, session retention, clearing, or native signing
- auto-lock, sleep handling, clipboard clearing, or biometric behavior
- Tauri commands, capabilities, CSP, filesystem, opener, notification, or updater access
- `glyph://` registration, link-broker behavior, parsing, nonce handling, request review, callbacks, or redirects
- encrypted persisted metadata or key storage
- dependencies, CI permissions, versioning, tags, release assets, native signing, notarization, updater signatures, or publication

Operating-system protocol registration and the in-app parser are separate boundaries. Parser tests do not prove that packaged protocol-handler invocation is safe.

A `glyph://` request can assert a dApp name and origin, but the custom protocol does not cryptographically prove which website launched it. Do not present claimed dApp identity as verified unless the protocol gains an association mechanism that establishes it.

## Dependency changes

- Prefer minimal, targeted updates.
- Keep both lockfiles synchronized and committed.
- Explain new runtime privileges, native dependencies, vendored code, or patched crates.
- Pin GitHub Actions and security-sensitive source revisions to immutable commits.
- Remove temporary patches when an audited upstream release makes them unnecessary.
- Re-run the relevant JavaScript and Rust audits.

## Changesets

Add a Changeset for user-visible features, fixes, security hardening, dependency changes with release impact, packaging changes, or release-process changes:

```sh
bun run changeset
```

Documentation-only corrections normally do not need a Changeset unless they materially change installation, security, compatibility, or release guidance. Do not manually bump versions or edit generated changelog sections as part of a feature pull request.

## Pull requests

A pull request should include:

- the problem and intended user or security outcome
- the chosen behavior and important alternatives
- tests and manual checks performed
- screenshots or recordings for visible changes
- security, storage, migration, compatibility, and rollback implications
- platform limitations and untested packaging paths
- a Changeset, or a short explanation of why none is needed

Use concise commit subjects that describe the outcome, for example:

- `feat(vaults): add account notes`
- `fix(requests): reject expired callbacks`
- `docs: clarify stable release promotion`

Keep history easy to review. Do not mix unrelated formatting, refactors, dependency updates, and behavior changes into one pull request.

## Release boundary

Contributor branches must not publish releases, move or replace tags, upload release assets, or use production signing credentials. Releases are created by the repository workflows described in [docs/RELEASING.md](./docs/RELEASING.md). Published tags and release assets are treated as immutable.

## License

Contributions are licensed under the repository's [MIT License](./LICENSE).
