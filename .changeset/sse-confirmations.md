---
"glyph": minor
---

Use Glyph SSE feeds as the live data path after the initial load. Tick, price, market, identity transaction, and event streams now update caches and notifications; history, balances, owned assets, and analytics are invalidated by identity frames instead of fixed-interval polling. Pending transactions resolve from transaction frames plus lifecycle reconciliation on connect, reconnect, lag, focus, and network-online, with tick-stream expiry. Polling remains only for the optional custom price feed and external exchange rates.
