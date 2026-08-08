# Native security findings

Audit scope: `src-tauri`, Tauri capabilities, deep links, and release/network tooling.

## Remediated

- Reduced the opener capability from its broad default set to URL opening only. The application only imports `openUrl`, so filesystem-opening permissions are unnecessary.
- Removed the unused frontend deep-link capability. Deep links are processed exclusively by the native handler.
- Hardened the callback command to reject embedded URL credentials even when invoked outside the deep-link parsing flow.
- Required `dapp.origin` to be a strict, credential-free HTTPS origin with no path, query, or fragment. This prevents ambiguous origin display and callback-origin comparisons.

## Remaining concerns

- Callback SSRF defenses resolve and pin the initial address, but callback requests still depend on the operating system resolver and TLS validation for public hosts.
- `cargo audit` installed in this environment does not support `--locked`; the release script uses its supported invocation, while Cargo compilation is run with `--locked`.
