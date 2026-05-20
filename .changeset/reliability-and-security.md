---
"sigil": patch
---

Reliability, security, and correctness fixes.

- TitleBar window handle is now created inside the component, preventing stale handles on hot reload
- Notification history state resets on account switch, preventing false "Confirmed" alerts
- Notification amounts use BigInt formatting, eliminating precision loss for large QU values
- Seed phrase input is masked during vault import
- Custom RPC URLs are validated before connecting; switching networks flushes the query cache
