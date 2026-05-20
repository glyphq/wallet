---
"sigil": patch
---

Fix pending transactions never being removed from history.

- Confirmed and expired pending txs now call `removePendingTx`; previously only notifications were fired and entries stayed in the store indefinitely
- History fetch is no longer gated on notification settings — cleanup runs regardless of whether notifications are enabled
- On first load, pending txs already present in history are silently removed without firing a notification
