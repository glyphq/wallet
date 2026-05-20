---
"sigil": patch
---

Fix persisted store merge crash on corrupted data; mount useAutoLock once at layout level instead of per-screen; remove duplicate pending-tx cleanup from history screen; fix account removal keeping stale activeAccountIndex; guard concurrent add account on Enter; fix Button missing type="button" default; fix Input autoComplete order blocking callers; remove Tag role="status" misuse; fix IdentityDisplay interval leak on unmount; fix request-screen permission re-check on every approvedDapps change
