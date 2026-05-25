---
"sigil": minor
---

Add shared request schemas and a central transaction domain module.

This unifies deep-link/request validation, shared request typing, and transaction normalization across history, analytics, search, and background flows. It also includes a polling selector stability fix to prevent a startup render loop.
