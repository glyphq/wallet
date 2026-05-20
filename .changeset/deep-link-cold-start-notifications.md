---
"sigil": patch
---

Fix cold-start deep link and add dApp request notifications.

- Cold-start deep link now correctly shows the request screen after unlock; the previous hook fired `get_pending_request` before the persisted store had rehydrated, saw `vaults.length = 0`, navigated to `/setup`, and cleared the Rust-side payload — leaving `pendingRequest` null by the time the user unlocked
- `useDeepLink` now waits for `persist.hasHydrated()` before reading the stored request, and uses a ref pattern so the single registered listener always sees current lock state without re-subscribing
- Removed the deep link handler's `/setup` navigation — root screen owns that routing
- Desktop notification fires on every incoming dApp request (transfer, SC call, sign message, verify message, connect) when notifications are enabled; includes contract name + amount for SC calls
