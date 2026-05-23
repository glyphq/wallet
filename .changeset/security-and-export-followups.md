---
"sigil": patch
---

Improve desktop wallet safety and export UX.

- harden deep-link callback handling against redirects, private-network resolution, and UTF-8 panic cases
- remove persisted trust for self-reported deep-link origins and queue incoming requests instead of replacing the active review
- encrypt persisted local metadata and fail closed on store read errors
- stabilize modal focus handling during request and settings flows
- use native save dialogs for contact and vault exports
