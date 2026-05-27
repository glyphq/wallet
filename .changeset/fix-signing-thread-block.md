---
"sigil": patch
---

Fix wallet freezing during Sign & Send by moving signing to a Web Worker

The FourQ SchnorrQ signing implementation in `@qubic.org/crypto` uses synchronous pure-JS BigInt scalar multiplication (`scalarBaseMult`) which was called three times per signing operation on the main thread. This blocked the Tauri WebView renderer, making the wallet appear unresponsive or crashed.

Signing is now dispatched to a dedicated Web Worker (`crypto.worker.ts`), keeping the main thread free during the elliptic curve computation. This covers transfer, smart contract call, and sign-message flows.
