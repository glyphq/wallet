---
"glyph": patch
---

Improve the reliability and safety of approved dApp callbacks.

- **Security:** Sign callback proofs in a dedicated native signing path after approval.
- **Reliability:** Keep approved requests pending until callback delivery has been attempted, allowing failures to be retried safely.
