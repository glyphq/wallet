---
"sigil": patch
---

Fix auto-updater signing and CI pipeline.

- Enable `createUpdaterArtifacts` in Tauri config so `.sig` files are generated during builds
- Rotate updater signing keypair
- Fix CI manifest script crashing under `pipefail` when `.sig` files are missing
- Fix Windows builds: NSIS-only, no version stripping, so the updater correctly detects new versions
- Fix repeated platform rebuilds triggered on every push to main
- Sync `Cargo.toml` version to 0.3.0
