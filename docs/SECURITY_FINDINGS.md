# Security audit follow-up

Audit scope: Tauri capabilities, native and renderer deep-link handling, callback delivery,
clipboard behavior, dependencies, shared UI primitives, and documentation.

## Remediated

- Reduced the opener capability from its broad default set to URL opening only. The application only imports `openUrl`, so filesystem-opening permissions are unnecessary.
- Removed the unused frontend deep-link capability. Deep links are processed exclusively by the native handler.
- Hardened the callback command to reject embedded URL credentials even when invoked outside the deep-link parsing flow.
- Required `dapp.origin` to be a strict, credential-free HTTPS origin with no path, query, or fragment. This prevents ambiguous origin display and callback-origin comparisons.
- Bounded renderer deep-link payloads, binary request fields, messages, pay-link labels, and the pending-request queue. The renderer now rejects malformed base64, unsigned-integer overflows, and invalid payment payloads before routing them into signing flows.
- Updated the timed clipboard fallback so it clears only the value Glyph placed on the clipboard, preserving a value copied by the user afterwards.
- Reduced duplicate form IDs, preserved caller-provided ARIA descriptions, restored keyboard-visible input focus, and added loading and modal accessibility semantics.
- Patched audited JavaScript transitive dependencies: `js-yaml` is pinned to 4.3.1 and `nanoid` to 3.3.18. `bun audit --audit-level=high` now passes.
- Centralized the renderer's public HTTPS URL policy and applied it before custom price-feed URLs are persisted or fetched. The policy rejects credentials and local, private, reserved, multicast, link-local, documentation, and IPv4-mapped non-global literal addresses.
- Limited pay-link input to 4 KiB before JSON parsing, protecting the renderer route boundary from oversized deep-link payloads.
- Enforced the native broker allowlist for direct request and payment deep links and reject duplicate query parameters, preventing parser differentials and ambiguous signing input.
- Removed stale RustSec `quick-xml` suppressions after the locked dependency graph updated to the fixed 0.41.0 release, so a regression now fails the audit.
- Tightened release-tag grammar to SemVer's hyphen-prefixed prerelease form, keeping the release channel decision and accepted tag syntax aligned.
- Improved shared controls with announced loading state, programmatic labels and descriptions, keyboard-visible input focus, and accessible navigation names.

## Remaining concerns

- Callback SSRF defenses resolve and pin the initial address, but callback requests still depend on the operating system resolver and TLS validation for public hosts.
- `cargo audit --deny warnings` fails for every unreviewed warning. The only explicit exceptions are inherited, unmaintained Tauri runtime and build dependencies, with rationale in `src-tauri/.cargo/audit.toml` and [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md#linux-tauri-stack). There are no reported Rust vulnerability failures in the locked graph.
- The native cryptographic compatibility implementation and release policy constraints described in [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md#residual-risks-and-follow-up) remain relevant and need upstream or governance work rather than local source changes.

## Validation

- `bun run check` with 32 frontend tests
- `bun run build`
- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' bun run audit:security`
- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test --manifest-path src-tauri/Cargo.toml --locked` with 19 native tests
