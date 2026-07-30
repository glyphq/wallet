---
"glyph": patch
---

Harden desktop deep-link handling and release security metadata.

- **Security:** Added a dedicated operating-system link broker that rejects malformed, split, oversized, and command-like `glyph://` launches before starting the wallet.
- **Packaging:** Registered and bundled the broker for Windows and Linux release artifacts while retaining native LaunchServices delivery on macOS.
- **Dependencies:** Updated vulnerable build dependencies and refreshed the JavaScript dependency lockfile.
- **License:** Released Glyph Wallet under the MIT License.
