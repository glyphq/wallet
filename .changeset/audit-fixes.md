---
"sigil": patch
---

Fix bugs and improve error messages across the wallet.

- **Send / Send Many:** Fixed a crash when entering a decimal amount (e.g. `1.5`) — `BigInt` cannot parse decimals and would throw before the review screen. Amount fields now reject non-integer values at validation time.
- **Notifications:** Fixed stale closures in notification triggers — toggling large-incoming, sent, confirmed, or missed-confirmation settings now takes effect immediately without waiting for an unrelated data refresh.
- **Lock screen:** Improved attempt-count error message from `WRONG PASSWORD (2/5)` to `WRONG PASSWORD — 3 ATTEMPTS REMAINING`, and expanded `WAIT 30s` to `WAIT 30 SECONDS` with correct pluralization.
- **Security:** Clarified the Linux biometric note to explain that the system secret service stores the password securely rather than using a biometric prompt.
