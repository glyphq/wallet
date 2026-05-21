---
"sigil": minor
---

Add Bob WebSocket transfer subscriptions for push-based cache invalidation: balance and tx history now update immediately on incoming/outgoing transfers when Bob is enabled and synced, replacing 5s polling latency. Health-gate all Bob WebSocket activity behind sync lag threshold so a lagging node never shows as live or triggers stale reads.
