---
"sigil": patch
---

Fix USD price display, price snapshots, and silent update errors

- Fix balance showing `≈ $0.00 USD` for all accounts: `formatUsdFromQu` was using BigInt integer-cent math (`Math.round(price * 100)`) which rounds the QU price (~$4×10⁻⁷) to zero; replaced with float multiplication which handles sub-cent prices correctly
- Fix price snapshots never updating after the first one: the deduplication threshold was an absolute `0.000001` which is larger than the entire QU price, so every subsequent snapshot was rejected as "essentially the same"; now uses a relative 0.1% threshold that works at any price magnitude
- Fix update install errors failing silently in settings: install errors set `lastError` but the display condition only checked `checkError || !updaterSupported`, so install failures were invisible; added `installError` state and show the error in red when install fails
