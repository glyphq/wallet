---
"sigil": minor
---

Deep link verify message, sign message improvements, and cold-start fix.

**Features**
- New `verify_message` deep link type: dApps can ask Sigil to verify a SchnorrQ signature against a message and public key; the sheet shows the message, claimed signer identity, and truncated signature; result (`valid: true/false`) is posted back via callback
- `sign_message` now accepts a `from` field so dApps can request signing from a specific identity; when omitted and the vault has multiple accounts, an account picker appears (matching the behaviour of `transfer` and `sc_call`)
- Success screen no longer shows `[CALLBACK DELIVERED]` when no callback URL was provided; instead a **Copy result** button lets the user copy the JSON response manually

**Fixes**
- Cold-start deep link: when Sigil is launched by clicking a `sigil://` link while the app is closed, the request now correctly appears after unlocking; previously the `sigil:request` event fired before the frontend listener was registered and was silently lost
