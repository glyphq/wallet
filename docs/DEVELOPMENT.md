# Glyph Development Guide

This guide is for contributors building, testing, and reviewing the current Glyph desktop wallet. It covers the verified local workflow, platform requirements, project structure, security-sensitive development rules, packaging, and release automation.

For runtime design and trust boundaries, read [ARCHITECTURE.md](./ARCHITECTURE.md). For product behavior, read [USER_GUIDE.md](./USER_GUIDE.md).

## 1. Toolchain

Glyph currently uses:

- Bun 1.3.14 in CI and release workflows
- Rust 1.88.0
- Tauri 2
- React 19
- TypeScript 5.8
- Vite 7

The Rust toolchain is declared in `src-tauri/rust-toolchain.toml`, not at the repository root. Use the `cargo` and `rustc` installed by rustup. Distribution-provided Rust commands can ignore the pin or be too old.

Install the required Rust toolchain:

```sh
rustup toolchain install 1.88.0
```

Verify it from the directory containing the toolchain file:

```sh
(
  cd src-tauri
  rustc --version
  cargo --version
)
```

CI expects Rust 1.88.0 even if a newer local compiler can build the project.

Node is also required because several repository scripts are `.mjs` files invoked with `node`. The repository pins Bun for CI but does not declare a local Node version in `package.json`.

## 2. Platform prerequisites

Install the native prerequisites from the [Tauri v2 prerequisite guide](https://v2.tauri.app/start/prerequisites/) for your operating system.

### Ubuntu and Debian development

The frontend and Tauri development build require:

```sh
sudo apt update
sudo apt install build-essential libwebkit2gtk-4.1-dev libdbus-1-dev
```

To build Linux AppImage, Debian, and RPM packages, also install:

```sh
sudo apt install libayatana-appindicator3-dev librsvg2-dev patchelf rpm xdg-utils
```

The current build does not require `libssl-dev` or `libxdo-dev` as project-specific dependencies.

### macOS

Install Xcode command-line tools and the other Tauri v2 macOS prerequisites. For a universal application build, install both Rust targets:

```sh
rustup target add aarch64-apple-darwin --toolchain 1.88.0
rustup target add x86_64-apple-darwin --toolchain 1.88.0
```

Universal builds also require `lipo`, supplied by Apple's developer tools.

### Windows

Install Microsoft C++ Build Tools, the WebView2 requirements, and the other Tauri v2 Windows prerequisites. Use a rustup-managed MSVC Rust toolchain. The packaged application uses an NSIS per-user installer.

## 3. Clone and install

```sh
git clone https://github.com/glyphq/wallet.git
cd wallet
bun install --frozen-lockfile
```

Use `--frozen-lockfile` to reproduce CI dependency resolution. Do not edit generated lockfile content by hand.

## 4. Run the application

### Full desktop development

Use this for normal feature work:

```sh
bun tauri dev
```

The Tauri build hook performs two steps before the application starts:

1. Builds a debug `glyph-link-broker` sidecar for the host target.
2. Starts the Vite development server.

Vite listens on `http://localhost:1420` with a strict port. If that port is occupied, the command fails instead of selecting another port.

The sidecar preparation script writes a target-suffixed binary under `src-tauri/binaries/`. That directory is generated and ignored by Git.

### Renderer-only development

```sh
bun run dev
```

This starts only Vite. It is useful for isolated visual work, but Tauri commands and plugins are not available in a normal browser tab. Vault cryptography, native session signing, store encryption, deep links, updater behavior, notifications, tray behavior, and platform integration cannot be validated this way.

### Preview a frontend production build

```sh
bun run build
bun run preview
```

This previews the generated web assets. It is not a substitute for testing a packaged Tauri application.

## 5. Build outputs

### Frontend only

```sh
bun run build
```

This runs TypeScript compilation and Vite production bundling. Output is written to `dist/`.

### Native application and packages

```sh
bun tauri build
```

The Tauri build hook:

1. Builds a release link-broker sidecar.
2. Runs the frontend production build.
3. Compiles the native application.
4. Creates packages for the current platform according to Tauri configuration.

Bundles are written below:

```text
src-tauri/target/release/bundle/
```

The repository does not contain production signing credentials. An unsigned local bundle is useful for functional testing but is not equivalent to a release artifact.

### Targeted package builds

Examples:

```sh
# Linux
bun tauri build --bundles appimage
bun tauri build --bundles deb,rpm

# macOS universal
bun tauri build --target universal-apple-darwin

# Windows
bun tauri build --bundles nsis
```

Cross-platform desktop packaging is not generally portable. Build each native package on its target operating system, as the release workflow does.

## 6. Command reference

Commands are defined in `package.json`.

| Command | Behavior |
| --- | --- |
| `bun run dev` | Starts the Vite renderer only |
| `bun run typecheck` | Runs `tsc --noEmit` |
| `bun run lint` | Runs non-pretty TypeScript checking, not ESLint |
| `bun run test` | Runs the Bun test suite |
| `bun run check` | Runs TypeScript checking, then Bun tests |
| `bun run build` | Runs TypeScript compilation and creates `dist/` |
| `bun run preview` | Serves the frontend production output |
| `bun tauri dev` | Builds the debug broker and runs the desktop application |
| `bun tauri build` | Builds the release broker, frontend, native application, and packages |
| `bun run release:check` | Checks synchronized versions and validates workflows and scripts |
| `bun run audit:security` | Audits Bun and Cargo dependencies, then checks the locked Rust graph |
| `bun run changeset` | Creates a Changesets release-note file |
| `bun run version` | Applies Changesets versions and synchronizes Tauri and Cargo versions |
| `bun run version:prerelease` | Applies the branch-aware prerelease version flow |
| `bun run tag-release` | Maintainer automation that creates and pushes an annotated release tag |

Do not run `bun run tag-release` during ordinary development. It performs remote Git operations by design.

## 7. Required local checks

### Fast frontend check

```sh
bun run check
```

This validates strict TypeScript and all Bun tests. It does not build the frontend bundle and does not compile Rust.

### Frontend production build

```sh
bun run build
```

This catches production bundling failures that `bun run check` does not exercise.

### Direct Rust check and tests

Tauri configuration declares the generated link-broker as an external binary. A fresh checkout may not have that binary yet. For direct Rust checks that do not need packaging, override `externalBin`:

```sh
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo check --manifest-path src-tauri/Cargo.toml --locked

TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo test --manifest-path src-tauri/Cargo.toml --locked
```

On PowerShell:

```powershell
$env:TAURI_CONFIG = '{"bundle":{"externalBin":[]}}'
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
Remove-Item Env:TAURI_CONFIG
```

Alternatively, prepare the host sidecar first:

```sh
node scripts/prepare-link-broker.mjs --debug
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

Always retain `--locked` in verification and CI-equivalent commands.

### Release workflow and script validation

```sh
bun run release:check
```

This command:

- Verifies that `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the root Glyph package in `Cargo.lock` have the same version.
- Runs Bash syntax checks on shell scripts and the Linux AppRun script.
- Runs `node --check` on repository `.mjs` scripts.
- Runs ShellCheck when installed.
- Downloads actionlint 1.7.12 into the user cache if needed.
- Verifies the actionlint archive SHA-256 before extracting it.
- Lints GitHub Actions workflows.

The helper currently downloads a Linux AMD64 actionlint archive and uses `sha256sum`. It is most directly supported on Linux or WSL and is the path used by CI. On other platforms, run it in a compatible environment or rely on the CI workflow.

### Dependency security audit

Install the pinned audit tool:

```sh
cargo install cargo-audit --version 0.22.2 --locked
```

Then run:

```sh
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' bun run audit:security
```

The script performs:

1. `bun audit --audit-level=high`
2. `cargo audit` in `src-tauri/`
3. `cargo check --manifest-path src-tauri/Cargo.toml --locked`

The `TAURI_CONFIG` override prevents a fresh checkout from failing only because the generated sidecar is absent. If the sidecar has already been prepared, the plain `bun run audit:security` command is sufficient.

### Recommended pre-push set

```sh
bun run check
bun run build
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo test --manifest-path src-tauri/Cargo.toml --locked
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo check --manifest-path src-tauri/Cargo.toml --locked
bun run release:check
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' bun run audit:security
```

For changes to packaging, deep-link registration, the tray, credential stores, the updater, or WebView behavior, also run `bun tauri build` and test the native package on every affected platform.

## 8. Tests

### Frontend tests

Bun discovers tests in the frontend and scripts. Current test areas include:

- RPC cache isolation by endpoint identity
- Formatting and amount behavior
- History analytics
- Notification event behavior
- External-request orchestration
- External-request schema validation
- Secure-session adapters
- Persisted-state sanitization and retention caps
- Immutable release-asset upload behavior

Run one file directly:

```sh
bun test src/lib/request-schema.test.ts
```

Run tests matching a name:

```sh
bun test --test-name-pattern "request"
```

When fixing a bug, add a regression test close to the domain logic rather than testing only a visual component.

### Rust tests

Native tests cover important logic in:

- Auto-lock behavior
- Link broker parsing and launch constraints
- Command validation
- Deep-link parsing and security validation
- Application argument handling
- Native signing and identity logic
- Vault cryptography

Run a focused test through Cargo's filter:

```sh
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo test --manifest-path src-tauri/Cargo.toml --locked deep_link
```

Platform credential-store and biometric code has less direct automated coverage than portable validation modules. Changes there require platform-specific manual validation in addition to unit tests.

## 9. Continuous integration

`.github/workflows/ci.yml` runs for relevant pushes and pull requests to `main` and `prerelease`. Markdown-only, sponsor, and Changesets-only changes are excluded by its path rules.

CI uses:

- Bun 1.3.14
- Rust 1.88.0
- Locked dependency resolution

Jobs include:

### Frontend, tests, and workflow quality

```sh
bun install --frozen-lockfile
bun run check
node scripts/sync-version.mjs --check
scripts/lint-workflows.sh
```

CI installs ShellCheck before the workflow lint step.

### Rust platform checks

Cargo check runs on:

- Ubuntu 22.04
- Current macOS runner
- Current Windows runner

The checks use:

```sh
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo check --manifest-path src-tauri/Cargo.toml --locked
```

This verifies native compilation without requiring the generated sidecar in the CI checkout.

### Security audit

CI runs:

```sh
bun audit --audit-level=high
cargo audit
```

It installs and caches `cargo-audit` 0.22.2.

CI Rust compilation is a platform matrix, but it is not a full GUI, installer, code-signing, notarization, or protocol-registration test. Those behaviors are validated by release jobs and targeted manual testing.

## 10. Source organization and change placement

### UI and routing

- Add or change routes in `src/router.tsx`.
- Put full feature pages in `src/screens/`.
- Use `src/layouts/` for route-level composition.
- Use `src/components/` for reusable interaction and presentation primitives.

### Network-derived state

- Put endpoint calls and client setup in `src/lib/rpc.ts` or the appropriate domain helper.
- Use TanStack Query hooks in `src/hooks/`.
- Include endpoint identity in query keys when cached results depend on the configured server.
- Apply polling profiles rather than creating independent high-frequency timers.

### Persisted state

- Update store types and actions in `src/store/`.
- Extend persisted-boundary sanitization for every new persisted field.
- Add explicit maximum lengths, collection caps, numeric ranges, and migration defaults.
- Add or update `src/store/persisted-boundary.test.ts`.
- Decide whether the data is a secret, local metadata, or reproducible network cache before persisting it.

Do not put active seeds into Zustand, browser storage, query cache, logs, diagnostics, or error messages.

### Native commands

- Register commands through the Tauri builder in `src-tauri/src/lib.rs`.
- Treat every renderer argument as untrusted.
- Validate sizes and numeric ranges before allocation, password derivation, network access, or signing.
- Return narrow serializable results.
- Avoid returning seeds or private key material unless the feature explicitly requires reveal or vault re-encryption.

### Qubic transaction features

- Keep transaction construction and signing in native Rust.
- Validate identity checksums, account indexes, signed amount bounds, ticks, contract indexes, input types, and payload sizes natively.
- Preserve the pending-outgoing guard in the UI.
- Distinguish broadcast acceptance from confirmation.
- Make irreversible actions explicit in the review screen.

### External requests

Changes to `glyph://` handling normally span:

- `src-tauri/src/link_broker.rs`
- `src-tauri/src/bin/glyph-link-broker.rs`
- `src-tauri/src/deep_link.rs`
- `src/lib/request-schema.ts`
- `src/lib/request-orchestration.ts`
- `src/components/request/`
- `src/screens/request/`
- Platform installer or desktop templates

Keep broker validation and native validation independent. The broker constrains process-launch input. Native validation remains authoritative for wallet behavior.

When adding a field or request type, verify:

1. Exact allowed query parameters
2. Encoded and decoded size limits
3. Parser duplicate handling
4. Native semantic validation
5. Renderer schema agreement
6. Expiry and nonce behavior
7. Locked-state queue behavior
8. Manual approval requirements
9. Callback and redirect origin rules
10. Result-history redaction and retention

### Tauri capabilities

Any new plugin or renderer privilege must be declared in `src-tauri/capabilities/default.json`. Grant the narrowest command and filesystem scope possible. Review the packaged CSP in `src-tauri/tauri.conf.json` whenever adding a remote resource or connection class.

A capability addition is a security-boundary change and should receive explicit review.

## 11. Security-sensitive coding rules

### Secret lifecycle

- Prefer Rust for secret processing.
- Use `zeroize` or zeroizing containers for mutable native secret buffers.
- Remember that JavaScript strings cannot be deterministically erased.
- Do not claim that seeds never enter the renderer. They currently cross IPC during unlock and selected vault-management flows.
- Clear the native session before emitting lock state to the renderer.
- Never log passwords, seeds, decrypted vaults, signing inputs that contain secret payloads, or callback result secrets.

### Cryptography

Do not change vault format constants casually. Current new-vault parameters are AES-256-GCM with PBKDF2-HMAC-SHA256 at 600,000 iterations, a 32-byte random salt, and a 12-byte random nonce.

A cryptographic-format change requires:

- A versioned format or migration plan
- Compatibility tests
- Corrupt-input and resource-bound tests
- Review of export and import behavior
- Documentation updates
- Independent security review

Do not invent custom encryption, signature, encoding, or key-derivation schemes.

### URL and callback validation

Do not rely on frontend validation for deep links or callbacks. Native validation must cover:

- Scheme and credentials
- Host and port normalization
- Same-origin requirements
- DNS resolution
- Every resolved IP address
- Private, loopback, link-local, multicast, and reserved ranges
- Redirect disabling
- Timeouts and body-size bounds
- Revalidation at delivery time
- Replay protection

Avoid shell execution and user-controlled executable paths in protocol handlers.

### Local persistence

The application-store encryption key is installation-local. This is at-rest protection, not a hardware security boundary. New diagnostics and exports must be reviewed for metadata leakage even if seeds and passwords are excluded.

### Dependencies

For dependency changes:

1. Prefer the smallest compatible update.
2. Review the package's transitive impact.
3. Keep Bun and Cargo lockfiles updated together with manifests.
4. Run both JavaScript and Rust advisory audits.
5. Review new Tauri plugins for capability and IPC exposure.
6. Review Qubic library updates for serialization and signing changes.

## 12. Manual validation matrix

Automated tests should be supplemented with targeted manual checks.

### Vault and session changes

- Create a vault and verify seed confirmation.
- Import a seed.
- Unlock with correct and incorrect passwords.
- Trigger the five-attempt temporary lockout.
- Add, reveal, remove, export, import, and delete accounts or vaults.
- Verify explicit lock clears signing ability.
- Verify inactivity, sleep, and optional blur locking.
- Restart and confirm only intended state persists.

### Transaction changes

- Reject invalid identities, zero, negative, fractional, and overflowing amounts.
- Check insufficient balance and pending-source guards.
- Review target-tick behavior.
- Test broadcast failure and later reconciliation.
- Confirm memos remain local.
- Test each affected smart-contract action with known safe values.

### Deep-link changes

- Test first launch and already-running application behavior.
- Test locked and unlocked states.
- Test malformed encoding, unknown and duplicate parameters, oversize input, expiry, and nonce replay.
- Test private and multi-address callback hosts.
- Test callback timeout, redirect response, oversized response, and delivery retry.
- Confirm no request signs or broadcasts without review.

### Platform changes

- Windows: protocol registration, broker launch, Credential Manager behavior, NSIS install and update.
- macOS: universal launch, Keychain behavior, deep links, signing, and notarization.
- Linux: AppImage launch and update, Debian and RPM installation, tray availability, Secret Service fallback, protocol desktop entry, and WSLg rendering.

## 13. Versioning and Changesets

User-visible changes should normally include a Changeset:

```sh
bun run changeset
```

Select the package and release level, then write a concise user-facing summary. Changesets are stored in `.changeset/`.

The automated version command is:

```sh
bun run version
```

It runs `changeset version`, then synchronizes the resulting `package.json` version into:

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- The root `glyph-wallet` package entry in `src-tauri/Cargo.lock`

Verify synchronization with:

```sh
node scripts/sync-version.mjs --check
```

The `prerelease` branch uses `scripts/version-prerelease.sh` through the branch-aware Changesets workflow.

## 14. Release architecture

Releases are maintainer automation, not a normal contributor command.

### Version PR and tag dispatch

`.github/workflows/changeset.yml` runs on `main` and `prerelease`:

1. Installs dependencies with the frozen Bun lockfile.
2. Uses Changesets to create or update a version PR.
3. When no release-note changes remain, runs `bun run tag-release`.
4. Creates an annotated immutable `v<version>` tag when it does not exist.
5. Requests the isolated `release.yml` workflow for that existing tag.

Stable tags must be reachable from `main`. Prerelease tags must be reachable from `prerelease` and contain a prerelease suffix.

The tag script refuses to move an existing remote tag. If an existing tag points elsewhere, it may request a safe retry only while the corresponding release is missing or still a draft.

### Release builds

The release workflow validates:

- Semantic tag format
- Annotated tag object
- Version synchronization
- Branch ancestry for the selected channel
- Draft-release state and prerelease flag

It then builds on native runners:

- Linux: signed AppImage, Debian, and RPM artifacts
- macOS: universal application artifacts with platform signing and notarization steps
- Windows: signed NSIS installer

Linux release packaging builds AppImage separately from Debian and RPM, patches the AppImage, then re-signs it. Release jobs generate checksums, provenance attestations, and updater metadata.

### Immutable assets

Release-asset upload code compares existing assets and skips byte-identical content. It refuses to replace a different asset under the same published identity. Published releases and tags are treated as immutable.

### Signing secrets

Update signing keys, Windows code-signing credentials, macOS signing certificates, notarization credentials, and related release secrets live in repository or CI secret storage. They must never be added to the source tree, local documentation examples, logs, or issue reports.

## 15. Debugging guidance

### Vite port already in use

Glyph requires port 1420 in development. Stop the conflicting process, then rerun `bun tauri dev`.

### Tauri cannot find `glyph-link-broker`

Prepare the host sidecar:

```sh
node scripts/prepare-link-broker.mjs --debug
```

For Cargo-only checks, use the `TAURI_CONFIG` override shown earlier.

### Wrong Rust version

Check command resolution:

```sh
which rustc
which cargo
(
  cd src-tauri
  rustc --version
  cargo --version
)
```

The expected binaries normally live under `~/.cargo/bin`. Reorder `PATH` if a distribution package shadows rustup.

### Linux WebKit build errors

Confirm `libwebkit2gtk-4.1-dev` and `libdbus-1-dev` are installed. For packaging errors, also confirm the AppIndicator, SVG, patching, RPM, and XDG tools listed in the prerequisite section.

### Linux tray icon missing

The application can run without a tray. On GNOME, install or enable an AppIndicator-compatible extension before treating the missing icon as an application regression.

### WSLg rendering problems

Glyph applies WSLg-specific WebKit environment flags in native startup. Test the full Tauri application, not a browser-only Vite session, before changing those flags.

### Direct Rust tests use the wrong toolchain

Because `rust-toolchain.toml` is under `src-tauri/`, either run Cargo from that directory or explicitly select 1.88.0. The CI workflow always installs 1.88.0 directly.

## 16. Documentation expectations

Documentation changes must distinguish:

- Renderer-only behavior from packaged Tauri behavior
- Local metadata from on-chain data
- Broadcast from confirmation
- Read-only assets from transferable asset support
- Scheduled templates from automatic payments
- Stored dApp permissions from silent authorization
- Long-lived native seed storage from transient renderer exposure
- Installation-local export HMAC verification from portable signature verification
- AppImage updater behavior from Debian and RPM package management
- Implemented platform scaffolding from enabled user-facing features

When behavior changes, update the relevant guide in the same change:

- [USER_GUIDE.md](./USER_GUIDE.md) for user workflows and caveats
- [ARCHITECTURE.md](./ARCHITECTURE.md) for runtime, state, trust, or cryptographic boundaries
- This file for setup, commands, tests, packaging, or release process

## 17. Before requesting review

Confirm all applicable items:

- [ ] The change has focused frontend or Rust regression tests.
- [ ] `bun run check` passes.
- [ ] `bun run build` passes.
- [ ] Locked Rust check and tests pass with the sidecar prepared or disabled through `TAURI_CONFIG`.
- [ ] `bun run release:check` passes for automation changes.
- [ ] JavaScript and Rust dependency audits pass for dependency changes.
- [ ] A full Tauri development run covers native integration.
- [ ] A native package was tested for packaging or platform changes.
- [ ] Persisted data has bounds, sanitization, and migration behavior.
- [ ] Native commands validate untrusted renderer input.
- [ ] New Tauri capabilities and CSP changes are minimal and reviewed.
- [ ] Secret values are absent from logs, diagnostics, fixtures, and screenshots.
- [ ] User-facing behavior has a Changeset when required.
- [ ] Documentation describes current behavior without overstating a security guarantee.
