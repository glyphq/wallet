# sigil

## 0.1.1-beta.1

### Patch Changes

- 2afdab3: Fix app stuck on loading screen in production builds caused by Tauri IPC not being ready when the store hydrates. Notifications now work correctly after store hydration is fixed. Replace the loading screen with a skeleton UI.

## 0.1.1-beta.0

### Patch Changes

- c10387e: Fix app stuck at [LOADING...] on production builds by making store hydration reactive. Rename installed binary to `sigil-wallet` to avoid conflict with the Sigil ebook editor on Debian/Kali systems.
