# Releasing Glyph

This guide documents the release process implemented by the current repository scripts and GitHub Actions workflows. Changesets owns version and changelog changes. Automation creates immutable annotated tags, builds platform packages, validates a draft release, creates the updater manifest, and publishes only after the required checks pass.

Release operations are maintainer-only. Contributors should add accurate Changesets and must not create or move release tags, upload production assets, or use signing credentials.

## Release model

| Integration branch | Channel | Version example | Updater manifest |
|---|---|---|---|
| `main` | Stable | `0.15.1` | `latest.json` |
| `prerelease` | Prerelease | `0.16.0-prerelease.0` | `latest-prerelease.json` |

Branch controls Changesets versioning and tag ancestry. The release workflow derives the channel from the tag itself: a tag containing `-` is a prerelease; a tag without `-` is stable.

The normal path is:

1. Merge release-relevant changes and their Changesets into the intended integration branch.
2. The Changesets workflow creates or updates a version pull request.
3. Review and merge the version pull request.
4. The next Changesets run creates an annotated tag and dispatches the isolated release workflow.
5. The release workflow builds into a draft, validates it, and publishes it.

Manual dispatch of `release.yml` is a retry or recovery operation for an existing tag. It is not the normal way to choose or create a version.

## Sources of truth

- Changesets configuration: `.changeset/config.json`
- Changesets automation: `.github/workflows/changeset.yml`
- Branch version selector: `scripts/version-for-branch.sh`
- Prerelease versioning: `scripts/version-prerelease.sh`
- Version synchronization: `scripts/sync-version.mjs`
- Tag creation and release request: `scripts/tag-release.mjs`
- Release pipeline: `.github/workflows/release.yml`
- Branch artifact builds: `.github/workflows/prerelease-artifacts.yml`
- Release asset validation: `scripts/validate-release-assets.mjs`

If this guide conflicts with those files, stop and reconcile the difference before releasing.

## Required credentials

GitHub Actions supplies `GITHUB_TOKEN` for version pull requests, tag pushes, workflow dispatch, draft release management, asset access, and publication.

Repository secrets used by release builds are:

| Secret | Stable | Prerelease | Purpose |
|---|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Required | Required | Sign updater payloads |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Required | Required | Unlock updater signing key |
| `APPLE_CERTIFICATE` | Required | Optional | macOS code signing certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Required | Optional | Unlock Apple certificate |
| `APPLE_ID` | Required | Optional | Apple notarization account |
| `APPLE_PASSWORD` | Required | Optional | Apple app-specific password |
| `APPLE_TEAM_ID` | Required | Optional | Apple signing team |
| `WINDOWS_CERTIFICATE` | Required | Optional | Base64-encoded Authenticode PFX |
| `WINDOWS_CERTIFICATE_PASSWORD` | Required | Optional | Unlock Windows certificate |

Stable macOS and Windows jobs fail when their native signing credentials are incomplete. Prerelease macOS and Windows jobs may produce artifacts without native platform signing when those optional credentials are absent. Updater signing credentials remain required by the release workflow for every channel.

`TAURI_UPDATER_PUBLIC_KEY` may override the public key used by the final validator; otherwise the validator reads the configured key from `src-tauri/tauri.conf.json`.

Never place secrets in workflow inputs, source files, Changesets, issues, pull requests, or command output.

## Before merging a version pull request

Confirm that:

- every intended release change is present on the correct branch
- every release-relevant change has an accurate Changeset
- the version impact is correct
- CI and security checks are green for the release commit
- no real secret or production data appears in the diff or logs
- platform, packaging, updater, and migration implications have been reviewed

Useful local checks are:

```sh
bun install --frozen-lockfile
bun run check
bun run build
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run release:check
bun run audit:security
```

`bun run release:check` verifies synchronized versions and lints workflow and release scripts. It does not replace frontend, Rust, packaging, or security checks.

## Changesets automation

`.github/workflows/changeset.yml` runs on every push to `main` and `prerelease`. It installs frozen dependencies and invokes `changesets/action` with:

- version command: `scripts/version-for-branch.sh`
- publish command: `bun run tag-release`
- version pull request title and commit: `chore: version packages`

### Stable branch versioning

On branches other than `prerelease`, the selector runs:

```sh
bun run version
```

That command runs `changeset version` and then `scripts/sync-version.mjs`.

### Prerelease branch versioning

On `prerelease`, the selector runs:

```sh
bun run version:prerelease
```

`scripts/version-prerelease.sh`:

1. requires any existing `.changeset/pre.json` to have `mode: "pre"` and `tag: "prerelease"`, or enters that pre mode if the file is absent;
2. runs `bun run changeset -- version`;
3. synchronizes the Tauri and Rust versions.

The resulting versions use the form `X.Y.Z-prerelease.N`.

### Files synchronized by versioning

`package.json` is the version input. `scripts/sync-version.mjs` keeps these files equal to it:

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- the `glyph-wallet` package entry in `src-tauri/Cargo.lock`

Changesets also updates `CHANGELOG.md` and consumes the included `.changeset/*.md` files.

## Stable promotion after a prerelease series

Merging a prerelease state into `main` does not automatically exit Changesets pre mode. A maintainer must prepare a focused stable-promotion pull request.

On a branch based on the intended stable commit:

```sh
bun install --frozen-lockfile
bun run changeset -- pre exit
bun run version
bun run release:check
bun run check
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

Review the generated diff carefully. It should:

- change `package.json` from `X.Y.Z-prerelease.N` to `X.Y.Z`
- remove `.changeset/pre.json` after versioning
- consume the accumulated Changesets
- add the stable `## X.Y.Z` section to `CHANGELOG.md`
- synchronize all four version locations

Do not run `bun run tag-release` locally. Merge the promotion pull request into `main`; the post-merge Changesets workflow owns tag creation and release dispatch.

## Tag creation and dispatch

When Changesets has no version pull request to create, it calls `bun run tag-release`.

`scripts/tag-release.mjs`:

1. validates `package.json.version`;
2. derives `v${version}`;
3. creates and pushes an annotated tag with message `Glyph ${version}` if the remote tag does not exist;
4. never moves an existing tag;
5. requests release dispatch only when the release is missing or still a draft;
6. skips dispatch when the matching release is already published.

The workflow then dispatches:

```sh
gh workflow run release.yml --ref "$RELEASE_REF" --field "tag=${RELEASE_TAG}"
```

`RELEASE_REF` is the branch that ran the Changesets workflow.

## Release workflow

`.github/workflows/release.yml` accepts one required input, an existing tag, plus an optional `allow_unsigned_native` emergency override that defaults to `false`. Its concurrency group is per tag and in-progress runs are not cancelled.

The workflow can start only when dispatched with the workflow ref set to `main` or `prerelease`. It checks out the immutable tag for application builds. Release-only automation that may need to repair an older tagged release, such as the immutable draft-asset uploader, is checked out separately from the exact reviewed workflow commit (`github.sha`) into `.release-automation`; it does not change the tagged application source being built.

### Prepare the draft

The prepare job requires:

- a supported semantic tag beginning with `v`
- `package.json.version` equal to the tag without `v`
- all synchronized version files to match
- an existing annotated tag object, not a lightweight tag
- a stable tag commit reachable from `origin/main`, or a prerelease tag commit reachable from `origin/prerelease`
- a matching non-empty changelog section headed `## VERSION`

It creates a draft release titled `Glyph VERSION`, or reuses a matching draft. An existing release must still be a draft and its prerelease flag must match the tag-derived channel. A published release is immutable and causes the workflow to fail rather than alter it.

### Platform builds

The three platform jobs run after draft preparation.

| Platform | Build output | Native signing policy |
|---|---|---|
| Linux | AppImage, deb, rpm | Updater signature required |
| macOS | universal app archive and DMG | Signing and notarization required for stable by default; optional for prerelease or an explicitly authorized emergency stable override |
| Windows | NSIS installer | Authenticode and timestamp required for stable by default; optional for prerelease or an explicitly authorized emergency stable override |

Prerelease release builds switch the bundled updater endpoint to `latest-prerelease.json` before building.

### Emergency unsigned stable publication

Native signing remains mandatory for stable releases by default. When Apple or Windows certificate provisioning is temporarily unavailable, an authorized maintainer may manually dispatch the workflow with `allow_unsigned_native=true`. This exception affects only Apple code signing/notarization and Windows Authenticode. Tauri updater signatures, SHA-256 checksums, release asset validation, and GitHub build-provenance attestations remain mandatory.

The workflow adds a prominent warning to the GitHub Release notes. Restore the default signed path as soon as the platform credentials are available. Do not use this override for an unattended Changesets dispatch or describe the resulting native installers as platform-signed.

#### Linux

The Linux job:

- installs the pinned build dependencies on Ubuntu 22.04
- prepares checksum-verified Tauri Linux bundler tools
- builds AppImage first, then deb and rpm packages
- patches AppStream metadata into the AppImage and re-signs it
- validates package structure and required updater signatures
- creates `SHA256SUMS-linux.txt`
- creates GitHub build-provenance attestations

#### macOS

The macOS job:

- builds a universal `x86_64` and `arm64` application
- normalizes the updater archive to `Glyph_VERSION_universal.app.tar.gz`
- verifies the universal executable architecture
- verifies code signatures, notarization ticket, and Gatekeeper assessment when native signing is enabled
- creates `SHA256SUMS-macos.txt`
- creates GitHub build-provenance attestations

The workflow does not currently mount or launch the DMG as a smoke test.

#### Windows

The Windows job:

- imports the base64 PFX when native signing is enabled
- signs with SHA-256 and the DigiCert timestamp service
- builds one NSIS installer and its Tauri updater signature
- verifies Authenticode status and timestamp when native signing is enabled
- creates `SHA256SUMS-windows.txt`
- creates GitHub build-provenance attestations

The workflow does not currently perform a silent install and uninstall smoke test.

### Updater manifest

After all platform jobs succeed, `scripts/create-updater-manifest.sh` downloads the draft updater signatures and requires exactly one signature for each updater payload:

- Windows `*.exe.sig`
- macOS `*.app.tar.gz.sig`
- Linux `*.AppImage.sig`

It creates `latest.json` or `latest-prerelease.json` with entries for:

- `windows-x86_64`
- `darwin-x86_64`
- `darwin-aarch64`
- `linux-x86_64`

Both macOS entries reference the universal archive. The workflow also creates a build-provenance attestation for the manifest.

### Final validation and publication

Before publication, `scripts/validate-release-assets.mjs` verifies that the release is still a draft and contains exactly one of every required asset. It also verifies:

- non-empty assets
- release version in every versioned payload filename
- manifest version and platform entries
- manifest URLs that reference existing assets
- Tauri/minisign signatures for AppImage, macOS updater archive, and Windows installer
- checksum file entry counts and SHA-256 contents

The validator does not currently verify the GitHub provenance attestations. The workflow creates those attestations, but attestation verification is not a publication gate.

After all validation succeeds:

- a prerelease is published with the prerelease flag
- a stable release is published and marked latest

## Required public asset set

A stable release contains exactly one of each:

### Linux

- `*.AppImage`
- `*.AppImage.sig`
- `*.deb`
- `*.rpm`
- `SHA256SUMS-linux.txt`

### macOS

- `Glyph_VERSION_universal.app.tar.gz`
- `Glyph_VERSION_universal.app.tar.gz.sig`
- `*.dmg`
- `SHA256SUMS-macos.txt`

### Windows

- `*.exe`
- `*.exe.sig`
- `SHA256SUMS-windows.txt`

### Updater

- stable: `latest.json`
- prerelease: `latest-prerelease.json`

GitHub provenance attestations are stored by GitHub's attestation service, not uploaded as ordinary release assets.

## Branch prerelease artifacts

`.github/workflows/prerelease-artifacts.yml` runs on every push to `prerelease` and can also be dispatched manually. It builds Linux, universal macOS, and Windows artifacts from the branch commit, configures the prerelease updater channel, adds per-platform checksums, and uploads GitHub Actions artifacts retained for 14 days.

These run artifacts are for testing. They do not create a version tag, GitHub Release, or updater manifest, and they do not publish anything. macOS and Windows branch artifacts may be unsigned at the native platform layer when their certificate credentials are absent.

## Safe retries and recovery

### Tag exists and the release is missing

Run the Changesets workflow again on the relevant branch, or manually dispatch `release.yml` from `main` or `prerelease` with the existing tag. For an explicitly approved emergency unsigned stable release, add `--field allow_unsigned_native=true`. Do not recreate or move the tag.

### Draft release exists

Rerun `release.yml` with the same tag. Existing asset names are downloaded and compared by SHA-256:

- a byte-identical asset is reused
- a missing asset is uploaded
- a same-named asset with different bytes fails the retry

Automation does not clobber divergent draft assets. Investigate the differing build before making a deliberate maintainer decision about the unpublished draft.

### Published release exists

Do not modify its tag or assets. If different binaries or notes are required, prepare a new patch release.

### Tag points at unexpected code

Never retag or force-push the tag. Determine whether the existing tag and release are valid. If new code must ship, create a new version.

### Version validation fails

Run:

```sh
node scripts/sync-version.mjs --check
```

Correct the versioning flow rather than hand-editing one manifest in isolation.

### Changelog extraction fails

Ensure `CHANGELOG.md` contains an exact `## VERSION` heading with a non-empty body for the tag version. Generate it through Changesets rather than adding release notes only in GitHub.

### Signing or validation fails

Keep the release as a draft. Correct the credential, build, signature, checksum, or asset problem and retry the same immutable tag only when doing so can reproduce byte-identical existing assets. Otherwise prepare a new version.

## Prohibited release actions

Do not:

- create lightweight release tags
- move, delete, or force-push release tags
- publish from a contributor branch
- upload production assets outside the controlled draft workflow
- use `gh release upload --clobber` as routine recovery
- replace or delete assets on a published release
- describe unsigned prerelease artifacts as equivalent to signed stable builds
- claim that provenance attestations, GUI launch, DMG mounting, or installer smoke tests are enforced when the current workflow does not enforce them

## Post-release verification

After publication, verify:

- the tag resolves to the intended commit and remains annotated
- stable or prerelease state is correct
- the complete platform asset set is present
- checksums and updater signatures verify
- the channel manifest references the published payloads
- the stable release is marked latest only for the stable channel
- supported installed packages recognize the expected update channel
- no secret or internal build data appears in release notes or logs
