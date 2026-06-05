---
"sigil": patch
---

Security and code quality fixes (25 issues)

**Security (H1–H5)**
- Transfer seed bytes to signing worker as a transferable `Uint8Array` instead of a plain string, so the seed never exists untracked in the structured-clone buffer
- Throw on tampered export file signatures rather than silently returning `verified: false`
- Guard against `null` `encryptedData` in both unlock paths on the lock screen
- Bind a SHA-256 hash of `vault_data` to the biometric credential at enroll time; reject mismatched blobs at unlock time so a compromised renderer cannot substitute an arbitrary ciphertext
- Persist the password lockout deadline to disk so it survives app restarts

**Medium (M1–M8)**
- Serialize `addToVault` through a module-level promise chain to prevent concurrent decrypt/re-encrypt races
- Expand PBKDF2 salt from 16 to 32 bytes; reject stored iteration counts below 100,000
- Log keyring read errors in `store_crypto` instead of silently falling through to key rotation
- Move `clear_pending_request` out of `applyPayload` and clear before processing to prevent infinite retry loop on IPC failure
- Remove `.passthrough()` from all dApp request schemas so unknown fields are stripped
- Read `pendingTxs` via a ref in the balance notification effect to prevent duplicate notifications on state updates
- Replace string-level `is_private_host` check in `post_callback` with DNS resolution validation
- Cap analytics pagination at 20 pages (2,000 transactions) and thread the query abort signal

**Low (L1–L12)**
- Replace `String.fromCharCode(...array)` spread with `Array.from` to avoid stack overflow on large byte arrays
- Remove `exportSigningPublicJwk` — HMAC is symmetric and has no public half
- Guard `effectiveIndex` against `-1` when wallet list is empty; sync `selectedIndex` with active account on external changes
- Use refs for `isLocked` and `allowBlurLockBypass` in blur lock handler to avoid stale closure
- Log store-key file permission failure instead of silently ignoring it
- Replace `starts_with("sigil://")` guard in deep link handler with a proper URL scheme parse
- Reuse the encrypted value on disk write retry instead of re-encrypting with a new nonce
- Set startup notification lookback to 24 hours so missed transactions are surfaced on fresh install
- Use `Math.floor` for request expiry comparison to avoid float/int mismatch
- Throw on balance response length mismatch instead of silently mapping missing entries to `0n`
- Guard `BigInt()` conversion in `BalanceBar` against non-integer amount strings
