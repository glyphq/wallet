---
"sigil": patch
---

Improve wallet security, reliability, and day-to-day usability.

- **Security:** Hardened deep-link validation, callback handling, local session safety, clipboard behavior, and local capability scope to reduce spoofing, unsafe network access, and secret exposure.
- **Wallet:** Moved sensitive vault/session handling further out of normal app state, improved Linux quick unlock, added per-account seed reveal, and tightened signing and auto-lock behavior.
- **Reliability:** Fixed dev-mode persistence issues, reduced flaky unlock and key handling, improved export and callback error reporting, bundled sponsor-name metadata locally, and made Qearn position loading less bursty.
- **UX:** Exports now use native save dialogs, receive QR codes scan more reliably, vault account management has clearer card-based structure, and several warnings and edge-case displays are easier to understand.
