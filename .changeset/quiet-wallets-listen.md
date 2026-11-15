---
"glyph": patch
---

Harden seed reveal, clipboard clearing, and recipient imports.

- **Security:** Timed, lock-time, and exit clipboard clears now verify that Glyph still owns the clipboard before blanking it, so content copied afterwards is preserved.
- **Reliability:** Seed reveal no longer dead-ends when the biometric preference is enabled but the vault has no enrolled credential; it falls back to the password path. The biometric requirement is only offered when enrollment is available.
- **Consistency:** Password rotation now uses the same 10-character minimum as onboarding. dApp requests use the same contract-index and signed 64-bit amount ranges in the renderer and the native validator.
- **UX:** CSV and JSON recipient imports no longer drop headerless rows whose identities contain the letters "to" or "qu", and zero-amount rows are rejected consistently.
