---
"sigil": patch
---

Fix app stuck on loading screen in production builds caused by Tauri IPC not being ready when the store hydrates. Notifications now work correctly after store hydration is fixed. Replace the loading screen with a skeleton UI.
