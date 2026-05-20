---
"sigil": patch
---

Correctness, accessibility, and performance improvements.

- Stake lock amount now uses BigInt directly — no more precision loss for large QU values
- Request previews accept amount as a string, preventing silent truncation of amounts above 2^53 QU
- Modal now traps focus and sets role="dialog" for keyboard and screen reader accessibility
- Toast messages now use aria-live so screen readers announce inline feedback
- All screen components are now lazy-loaded, reducing initial parse time on startup
