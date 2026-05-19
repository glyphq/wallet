# sigil

## 0.2.0-beta.3

### Minor Changes

- e68f33b: Polish and request-screen improvements.

  **Features**

  - Directional page transitions (slide left/right based on route depth), balance counter animation, lock/unlock fade+scale animation
  - Request screen: account picker lets user choose signing account when dApp omits `from`; `from`-identity resolution validates the requested identity is in the active vault and shows an error if not
  - Deep-link with no vault → redirects to setup screen instead of crashing

  **Fixes**

  - Pending transactions now resolve against `getLastProcessedTick` (archive) instead of network tick, giving sub-second confirmation vs. up to 30s
  - 4-position seed-phrase spot-check replaces the previous 55-tap grid backup flow
  - Deep-link callback validator now accepts `http://localhost` and `http://127.0.0.1` for local development
  - Store IPC timeout raised to 1500 ms (safety net 3 s) to prevent hydration failures in debug builds
  - Settings screen gains a back button in the header
  - `window.__TAURI__` exposed globally for DevTools console testing (`withGlobalTauri: true`)
  - Updated app icons across all platforms and sizes

## 0.2.0-beta.2

### Minor Changes

- 0d7ab29: Add custom title bar replacing the OS native one. Includes drag region, minimize/maximize/close controls with hover states, and fullscreen prevention on Windows.

## 0.1.1-beta.1

### Patch Changes

- 2afdab3: Fix app stuck on loading screen in production builds caused by Tauri IPC not being ready when the store hydrates. Notifications now work correctly after store hydration is fixed. Replace the loading screen with a skeleton UI.

## 0.1.1-beta.0

### Patch Changes

- c10387e: Fix app stuck at [LOADING...] on production builds by making store hydration reactive. Rename installed binary to `sigil-wallet` to avoid conflict with the Sigil ebook editor on Debian/Kali systems.
