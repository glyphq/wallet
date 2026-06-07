---
"sigil": patch
---

Fix two lint errors surfaced after the second audit

- Remove stale `exportSigningPublicJwk` reference in `diagnostics-screen.tsx` (field was deleted in the first audit pass)
- Drop unused `passwordAttempts` binding in `lock-screen.tsx`; re-render is triggered through the setter, the value itself is never read
