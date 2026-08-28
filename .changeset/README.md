# Changesets in Glyph

Changesets are the source material for Glyph versions and release notes. They describe releasable outcomes; they are not commit logs, review summaries, or a place to record every internal refactor.

Glyph is a private package. Changesets does not publish it to a package registry. The Changesets GitHub workflow uses the generated version as the source for an annotated Git tag and the desktop release pipeline.

## When a Changeset is required

Add a Changeset for:

- user-visible features or behavior changes
- bug fixes and reliability improvements
- security or privacy hardening
- dependency changes with runtime, security, or packaging impact
- compatibility or migration changes
- platform package, updater, or release-process changes

A Changeset is usually not required for:

- typo-only documentation corrections
- tests that do not change shipped behavior
- internal refactoring with no user, security, dependency, compatibility, or packaging effect
- contributor tooling that cannot affect produced artifacts

If a documentation change materially changes installation, security, compatibility, or release guidance, include a Changeset.

## Create a Changeset

From the repository root:

```sh
bun run changeset
```

Select the `glyph` package, choose the semantic impact, and edit the generated `.changeset/*.md` file.

Do not manually edit `package.json.version`, `CHANGELOG.md`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, or `.changeset/pre.json` in an ordinary feature pull request. The version workflows own those generated changes.

## Choose the version impact

- **Patch:** backward-compatible fixes, security hardening, reliability improvements, small user-visible refinements, and packaging corrections.
- **Minor:** a backward-compatible feature or substantial new capability.
- **Major:** an intentionally incompatible change that requires users, integrations, or stored data to migrate.

Choose impact by compatibility and user consequence, not by diff size. When unsure, explain the compatibility question in the pull request so reviewers can confirm the level.

The frontmatter for this repository is:

```md
---
"glyph": patch
---
```

Replace `patch` with `minor` or `major` when appropriate.

## Write release-note input

Write for the person installing or using Glyph.

Good Changesets:

- lead with the visible outcome
- explain security impact without exposing an exploit before coordinated disclosure
- mention migration, compatibility, or platform limits users need to know
- group related outcomes under short labels such as `Security`, `Wallet`, `UX`, `Reliability`, `Packaging`, or `Updates`
- stay concise enough to scan in a release page

Avoid:

- commit-title fragments such as “refactor x”
- file names, module names, and implementation details unless users need them
- exhaustive lists of internal edits
- marketing claims that are not demonstrated by the change
- unrelated changes combined only because they share a pull request
- promises about platforms or signing paths that were not tested

Prefer one cohesive Changeset for one releasable outcome. A pull request may contain more than one when it intentionally ships independently meaningful changes at different semantic levels. Do not add one Changeset per commit.

## Recommended format

```md
---
"glyph": patch
---

Improve [user-visible area or outcome].

- **Security:** [What is safer and what boundary changed.]
- **Wallet:** [What behavior the user will notice.]
- **Reliability:** [What failure or edge case is now handled.]
- **UX:** [What interaction became clearer or more accessible.]
```

Use only the bullets that add useful release information.

## Examples

### Security and signing

```md
---
"glyph": patch
---

Reduce seed exposure during wallet use.

- **Security:** Moved transaction and message signing into the native session so signing no longer requires returning seed material to the renderer.
- **Reliability:** Added native validation and rate limits around signing requests.
```

### New capability

```md
---
"glyph": minor
---

Add scheduled transfer management.

- **Wallet:** Users can create, review, and cancel scheduled transfers from the Send section.
- **Safety:** Review screens show the selected account, destination, amount, and schedule before confirmation.
```

### Packaging fix

```md
---
"glyph": patch
---

Improve Linux package reliability.

- **Packaging:** Corrected AppImage metadata and validated the AppImage, deb, and rpm outputs before release publication.
```

## Branch behavior

`.github/workflows/changeset.yml` runs on pushes to `main` and `prerelease`.

### `main`

The workflow uses:

```sh
bun run version
```

This runs `changeset version`, updates `CHANGELOG.md`, consumes included Changesets, and synchronizes the version across the JavaScript, Tauri, and Rust manifests.

### `prerelease`

The workflow uses:

```sh
bun run version:prerelease
```

This enters or continues Changesets pre mode with tag `prerelease`, versions the project as `X.Y.Z-prerelease.N`, and synchronizes the native manifests. If `.changeset/pre.json` exists with a different mode or tag, the script fails rather than silently changing channels.

Do not hand-edit prerelease state. Stable promotion from an accumulated prerelease series is a maintainer workflow documented in [docs/RELEASING.md](../docs/RELEASING.md).

## Version pull request and release

On each integration-branch push, `changesets/action` does one of two things:

1. when unreleased Changesets exist, it creates or updates the `chore: version packages` pull request;
2. after the version pull request is merged and there is no version update left to prepare, it runs `bun run tag-release`.

The tag script creates an immutable annotated `vX.Y.Z` or prerelease tag and requests the release workflow. The release workflow builds desktop packages and publishes a GitHub Release; it does not publish `glyph` to npm.

## Review checklist

Before approving a Changeset, verify:

- the package name is exactly `glyph`
- the semantic impact matches compatibility and user consequence
- the summary describes shipped behavior, not implementation activity
- security wording is accurate and coordinated disclosure is preserved
- platform and updater claims match what was tested
- unrelated outcomes are split or clearly grouped
- no seed, credential, private endpoint, exploit detail, or personal data appears in the note
- the corresponding code, tests, and documentation support every claim

For the complete tag, artifact, signing, retry, and publication process, see [docs/RELEASING.md](../docs/RELEASING.md).
