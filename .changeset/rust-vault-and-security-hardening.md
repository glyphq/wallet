---
"sigil": patch
---

Harden wallet security and move vault cryptography into the Rust backend.

- move vault encryption and decryption into Rust and have biometric unlock return decrypted seeds instead of a plaintext vault password
- harden callback and deep-link validation against replay, IP literal, and non-HTTPS origin edge cases
- restrict localhost CSP access and scope export filesystem permissions
- validate RPC and Bob endpoints more strictly and sanitize export filenames, surfaced errors, and desktop notifications
- cap persisted pending transactions and hide unrevealed seed text from the DOM
