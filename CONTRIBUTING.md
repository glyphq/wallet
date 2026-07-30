# Contributing to Glyph

## Prerequisites

- Bun 1.3.14
- Rust 1.88.0 through rustup
- Platform dependencies documented in [README.md](./README.md#build-locally)
- `cargo-audit` 0.22.2 for dependency security checks

```sh
cargo install cargo-audit --version 0.22.2 --locked
```

Use the repository-pinned tool versions. Avoid distribution Rust packages that bypass `rust-toolchain.toml`.

## Setup

```sh
git clone https://github.com/glyphq/wallet
cd wallet
bun install --frozen-lockfile
bun tauri dev
```

Never add wallet seeds, signing keys, certificates, `.env` files, release credentials, or production exports to the repository.

## Required checks

Run these before requesting review:

```sh
bun run check
bun run build
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run release:check
bun run audit:security
```

`bun run release:check` validates synchronized versions and workflow policy. `bun run audit:security` fails on high-severity JavaScript advisories or RustSec vulnerabilities.

## Security boundaries

Changes touching these areas require targeted regression tests and explicit reviewer attention:

- vault encryption, decryption, key storage, or migration
- native session state, locking, seed reveal, or signing
- Tauri commands, capabilities, CSP, updater, filesystem, opener, or clipboard access
- `glyph://` registration, broker behavior, request parsing, callback delivery, or redirects
- CI, release tags, draft assets, native signing, notarization, or updater signatures

OS protocol-handler registration must be reviewed independently from in-app URL validation. Parser tests alone do not prove packaged handler safety.

Custom-protocol dApp identity is self-asserted. Do not present a claimed origin as verified unless a cryptographic association mechanism is implemented.

## Dependency changes

- Keep `bun.lock` and `src-tauri/Cargo.lock` committed.
- Prefer minimal, targeted lockfile updates.
- Pin workflow actions and security backports to immutable revisions.
- Explain vendored or patched dependencies in the manifest and remove them once an audited crates.io release is available.

## Pull requests

Keep changes small and linear. Include:

- the user-visible or security outcome
- tests and manual checks performed
- platform limitations or untested packaging paths
- migration and rollback considerations for breaking changes

Do not publish releases, move tags, or upload artifacts from a contributor branch.
