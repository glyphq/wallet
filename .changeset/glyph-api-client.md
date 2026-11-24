---
"glyph": minor
---

Route all chain reads and signed-transaction broadcasts through the generated Glyph API client. Network settings now store one HTTPS API origin instead of separate live and archive RPC URLs; legacy values migrate to the bundled mainnet API. Contract reads and QEarn/QUtil balances keep their typed helpers over the API's contract-query route.
