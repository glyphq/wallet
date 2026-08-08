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

## Remaining concerns

- Callback SSRF defenses resolve and pin the initial address, but callback requests still depend on the operating system resolver and TLS validation for public hosts.
- `cargo audit` reports inherited, allowlisted warnings in Tauri's Linux GTK3/WebKit stack. The rationale and upstream constraints are recorded in [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md#linux-tauri-stack). There are no reported Rust vulnerability failures in the locked graph.
- The native cryptographic compatibility implementation and release policy constraints described in [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md#residual-risks-and-follow-up) remain relevant and need upstream or governance work rather than local source changes.

## Validation

- `bun run check` with 32 frontend tests
- `bun run build`
- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' bun run audit:security`
- `TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo test --manifest-path src-tauri/Cargo.toml --locked` with 19 native tests
