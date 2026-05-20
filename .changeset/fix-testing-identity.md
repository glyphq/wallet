---
"sigil": patch
---

Fix test dApp identity and verify_message instructions in TESTING.md.

- Replace `AAAA...AAAA` dummy identity with the Sigil donation address which has a valid Qubic checksum — the all-A identity passed Rust format validation but failed the frontend checksum check, causing `[Invalid identity]` on every transfer test
- Clarify verify_message setup steps: sign a message first, copy `signature` and `public_key` from the result, paste into the HTML — the placeholder literal strings were being sent as-is
