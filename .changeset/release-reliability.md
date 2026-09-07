---
"glyph": patch
---

Improve desktop release reliability.

- **Packaging:** Default native desktop bundles to unsigned until platform signing credentials are configured, while retaining required updater signatures.
- **Packaging:** Correctly validate the Debian package identity before publishing Linux bundles.
