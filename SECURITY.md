# Security Policy

## Supported Versions

Only the latest release receives security fixes. We do not backport patches to older versions.

| Version | Supported |
| ------- | --------- |
| Latest  | ✓         |
| Older   | ✗         |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via GitHub's [Security Advisories](https://github.com/glyphq/wallet/security/advisories/new), or email **security@glyph.app**.

Include as much of the following as possible:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected version(s)
- Any mitigations you are aware of

We aim to acknowledge reports within **48 hours** and provide a resolution timeline within **7 days**.

## Scope

### In scope

- Seed / private key exposure or exfiltration
- Bypass of vault encryption or biometric authentication
- Transaction signing without user authorization
- dApp permission escalation (approving more than the user granted)
- Tauri IPC command injection from the webview
- CSP bypass allowing untrusted script execution
- Supply-chain vulnerabilities in direct dependencies

### Out of scope

- Attacks requiring physical access to an unlocked device
- OS-level keyloggers or screen capture
- Vulnerabilities in Tauri itself (report to [tauri.app/security](https://tauri.app/security))
- Social engineering
- Theoretical attacks without a working proof-of-concept

## Architecture notes for researchers

Glyph is a **Tauri v2** desktop app. The frontend (React) runs in a sandboxed webview and communicates with native code exclusively via `invoke()` IPC — there are no Node.js APIs in the renderer. Key properties:

- **No remote code execution**: CSP blocks `eval` and inline scripts. All JS is bundled at build time.
- **Native vault boundary**: Vault encryption, decryption, and long-lived unlocked seed retention happen in Rust. The current signing bridge creates a short-lived seed copy in an isolated renderer worker and wipes it after signing. Moving signing fully native remains a tracked hardening goal.
- **Explicit IPC surface**: Only registered Tauri commands are callable from the webview. Security-sensitive handlers validate inputs, and native lock paths clear the native session before notifying the renderer.
- **Constrained network access**: JavaScript RPC traffic is restricted by CSP. Native callback delivery requires HTTPS, rejects non-global addresses, pins the validated DNS result for the connection, and requires the callback origin to match the request's claimed dApp origin.
- **Unverified custom-protocol identity**: A `glyph://` request can claim a dApp name and origin but cannot cryptographically prove the website that launched it. The review UI labels this identity as unverified, and delivery endpoints are bound to the same claimed origin.
- **Experimental Bob node**: If enabled, the Bob indexer must run on `localhost` — remote Bob endpoints are blocked by CSP in production builds.

## Dependency auditing

Rust dependencies are audited against the [RustSec Advisory Database](https://rustsec.org/) and JS dependencies against the npm advisory registry on every CI run.
