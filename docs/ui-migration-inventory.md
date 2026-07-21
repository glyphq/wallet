# Glyph Wallet UI Migration Inventory

Last updated: 2026-07-19
Branch: `feat/ui-improvements`

## 1. Scope snapshot

This repository currently exposes a compact frameless Tauri wallet UI with:

- 33 router paths in `src/router.tsx`
- 31 screen files under `src/screens/**`
- 29 shared component files under `src/components/**`
- 5 layout files under `src/layouts/**`
- 21 hook files under `src/hooks/**`
- 8 store files under `src/store/**`
- 38 `<Sheet` usages across the app
- 0 current `<Modal` usages, even though a modal primitive still exists
- 74 `<Button` usages, with many screens still mixing inline button styling and the shared primitive

The current interface is cohesive enough to be functional, but it still reflects the earlier Phantom-inspired system: floating navigation, heavy pill usage, multiple translucent surfaces, inconsistent spacing density, and too many inline style literals. The migration target is a quieter, more typographic, more infrastructure-like Glyph system.

## 2. Baseline validation before migration

The required baseline commands were run before the migration work:

- `bun install` ✅
- `bun run typecheck` ✅
- `bun run test` ✅
- `bun run build` ✅
- `cargo check --manifest-path src-tauri/Cargo.toml --locked` ✅
- `bun run release:check` ✅

Observed note:

- `bun run release:check` reported `shellcheck not installed; skipping shell lint`. The script still exited successfully.

Current baseline build characteristics observed before the broader redesign:

- Default Tauri window already matches the brief in `src-tauri/tauri.conf.json`
  - width `380`
  - height `680`
  - min `360 × 640`
  - max `420 × 760`
  - `decorations: false`
  - `maximizable: false`
- The frontend build already uses route-level lazy loading.
- Current bundle output is functional and warning-free after earlier chunk splitting work.

## 3. Existing brand and product assets

Canonical repository assets that must be reused during the migration:

### Brand images

`src/assets/brand/`

- `glyph-dark.png`
- `glyph-light.png`
- `glyph-on-dark.png`
- `glyph-on-light.png`

### Tauri icons

`src-tauri/icons/`

- desktop bundle icons: `icon.icns`, `icon.ico`, `icon.png`, PNG size variants
- platform-specific icon sets for Android and iOS already exist

Migration implication:

- no new logo generation
- no CSS reconstruction of the mark
- no AI-generated replacement assets
- use the existing wordmark and mark only where product identification is actually useful

## 4. Router and route inventory

`src/router.tsx` currently defines 33 routes:

### Entry and auth

- `/`
- `/lock`

### Setup

- `/setup`
- `/setup/create`
- `/setup/import`

### Core wallet

- `/dashboard`
- `/vaults`
- `/vaults/:id`
- `/vaults/:id/portfolio`
- `/send`
- `/send/scheduled`
- `/send-many`
- `/burn`
- `/stake`
- `/earn`
- `/receive`
- `/payment-link`

### History and analysis

- `/history`
- `/tx/:hash`
- `/analytics`

### Contacts and search

- `/contacts`
- `/search`

### Request and dApp flow

- `/request`

### Settings and system

- `/settings`
- `/settings/dapps`
- `/settings/request-history`
- `/settings/security`
- `/settings/security/audit-log`
- `/settings/network`
- `/settings/contacts`
- `/settings/notifications`
- `/settings/support`
- `/settings/diagnostics`

Route-level observations:

- `AnimatedLayout` owns global chrome, routing transitions, and bottom nav state.
- `/request` is intentionally chrome-less and special-cased.
- `/settings/contacts` reuses the contacts screen and needs to remain semantically distinct from `/contacts`.
- `/earn` and `/stake` both resolve to `StakeScreen`, so their title, labels, and nav context must be handled carefully during migration.

## 5. Screen inventory by domain

### Setup and entry

- `src/screens/splash/splash-screen.tsx`
- `src/screens/lock/lock-screen.tsx`
- `src/screens/setup/welcome-screen.tsx`
- `src/screens/setup/create-vault-screen.tsx`
- `src/screens/setup/import-vault-screen.tsx`

### Dashboard and vault management

- `src/screens/dashboard/dashboard-screen.tsx`
- `src/screens/vaults/vaults-screen.tsx`
- `src/screens/vaults/vault-detail-screen.tsx`
- `src/screens/vaults/portfolio-screen.tsx`

### Transaction flows

- `src/screens/send/send-screen.tsx`
- `src/screens/send/send-many-screen.tsx`
- `src/screens/send/scheduled-transfers-screen.tsx`
- `src/screens/send/burn-screen.tsx`
- `src/screens/stake/stake-screen.tsx`
- `src/screens/receive/receive-screen.tsx`
- `src/screens/receive/payment-link-screen.tsx`

### History and analytics

- `src/screens/history/history-screen.tsx`
- `src/screens/history/tx-detail-screen.tsx`
- `src/screens/history/analytics-screen.tsx`

### Contacts and search

- `src/screens/contacts/contacts-screen.tsx`
- `src/screens/search/search-screen.tsx`

### dApp requests

- `src/screens/request/request-screen.tsx`

### Settings and system screens

- `src/screens/settings/settings-screen.tsx`
- `src/screens/settings/dapps-screen.tsx`
- `src/screens/settings/request-history-screen.tsx`
- `src/screens/settings/security-screen.tsx`
- `src/screens/settings/audit-log-screen.tsx`
- `src/screens/settings/network-screen.tsx`
- `src/screens/settings/notifications-screen.tsx`
- `src/screens/settings/support-screen.tsx`
- `src/screens/settings/diagnostics-screen.tsx`

## 6. Shared shell and primitive inventory

### Layout files

- `src/layouts/animated-layout.tsx`
- `src/layouts/app-shell.tsx`
- `src/layouts/full-page.tsx`
- `src/layouts/header-slot.tsx`
- `src/layouts/sheet-state.tsx`

### Core shell primitives

- `src/components/title-bar.tsx`
- `src/components/bottom-nav.tsx`
- `src/components/screen-header.tsx`
- `src/components/settings-page-header.tsx`
- `src/components/sheet.tsx`
- `src/components/modal.tsx`
- `src/components/error-boundary.tsx`

### Form and action primitives

- `src/components/button.tsx`
- `src/components/input.tsx`
- `src/components/settings-switch.tsx`
- `src/components/tag.tsx`
- `src/components/divider.tsx`

### Data and wallet presentation primitives

- `src/components/detail-row.tsx`
- `src/components/review-row.tsx`
- `src/components/tx-row.tsx`
- `src/components/tx-status.tsx`
- `src/components/identicon.tsx`
- `src/components/identity-display.tsx`
- `src/components/tx-memo-field.tsx`

### Request-specific shared components

- `src/components/request/connect-preview.tsx`
- `src/components/request/request-header.tsx`
- `src/components/request/sc-call-preview.tsx`
- `src/components/request/sign-message-preview.tsx`
- `src/components/request/transfer-preview.tsx`
- `src/components/request/verify-message-preview.tsx`

### Existing shell findings

- `TitleBar` already respects Tauri drag regions and custom controls.
- `BottomNav` still presents as a floating pill-like element and uses blur and translucent surfaces that conflict with the target direction.
- `AnimatedLayout` owns header, nav, and lock countdown, but screen chrome conventions remain split between shared headers and bespoke inline headers.
- `AppShell` hard-codes `paddingBottom: 76`, which should become a semantic shell token rather than a one-off.
- `modal.tsx` exists but is not currently used by routes or screens. It should either be migrated and retained as a canonical overlay primitive or removed if sheet-only behavior remains the intended product pattern.

## 7. Overlay and dialog inventory

There are 38 `<Sheet` usages across 12 files.

### Highest overlay density

- `src/screens/vaults/vaults-screen.tsx` — 11 usages
- `src/screens/vaults/vault-detail-screen.tsx` — 9 usages
- `src/screens/contacts/contacts-screen.tsx` — 3 usages
- `src/screens/request/request-screen.tsx` — 3 usages
- `src/screens/history/history-screen.tsx` — 2 usages
- `src/screens/send/send-many-screen.tsx` — 2 usages
- `src/screens/setup/welcome-screen.tsx` — 2 usages

### Overlay-specific migration implications

- the app is operationally sheet-first, not modal-first
- the canonical `Sheet` primitive is therefore one of the most important migration anchors
- the vault management surfaces are the biggest single overlay hotspot and will likely need structural cleanup during migration
- every sheet state must be visually and behaviorally normalized around the new system, not restyled ad hoc per screen

## 8. Loading, empty, error, pending, and success state inventory

### Files with explicit loading-state branches

- `src/hooks/use-balance.ts`
- `src/screens/dashboard/dashboard-screen.tsx`
- `src/screens/history/analytics-screen.tsx`
- `src/screens/history/history-screen.tsx`
- `src/screens/stake/stake-screen.tsx`
- `src/screens/vaults/portfolio-screen.tsx`
- `src/store/ui.ts`

### Files with explicit error-state branches

- `src/hooks/use-balance.ts`
- `src/hooks/use-network-health.ts`
- `src/screens/history/history-screen.tsx`

### Strongly stateful flows requiring dedicated migration coverage

These screens contain the highest density of conditional UI and therefore the highest regression risk during redesign:

- `send-screen.tsx`
- `send-many-screen.tsx`
- `burn-screen.tsx`
- `stake-screen.tsx`
- `request-screen.tsx`
- `vault-detail-screen.tsx`
- `vaults-screen.tsx`
- `history-screen.tsx`
- `lock-screen.tsx`
- `welcome-screen.tsx`
- `create-vault-screen.tsx`
- `import-vault-screen.tsx`

### Existing cross-cutting state primitives

- route fallback in `src/router.tsx`
- render fallback in `src/components/error-boundary.tsx`
- network health semantics in `src/hooks/use-network-health.ts`
- runtime issues logging in `src/App.tsx` and diagnostics
- update state in `src/hooks/use-updater.ts`

Migration implication:

The migration cannot stop at happy-path restyling. It must normalize:

- empty states
- retryable failures
- offline or degraded network state
- pending transaction states
- request approval and rejection states
- diagnostics and recovery messaging

## 9. Token system and appearance constraints

### Current token source of truth

- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/lib/appearance.ts`
- `src/App.tsx` applies persisted appearance values to CSS variables

### Existing persisted appearance constraints

`src/lib/appearance.ts` currently preserves:

- font pair selection
- custom scheme override
- accent selection

This means the migration must not break:

- `settings.fontPair`
- `settings.customScheme`
- accent mappings already stored in persistence

### Current token gaps versus the new brief

Current token file is underspecified for the target system. It is missing or incomplete for:

- control height tokens
- title bar height token
- bottom nav height token
- sheet padding tokens
- screen-padding tokens by viewport tier
- focus ring tokens
- divider hierarchy tokens
- skeleton tokens
- chart tokens
- safe-bottom spacing tokens
- z-index layer tokens
- accent hover, accent muted, accent contrast, and focus-ring variants
- semantic tertiary text token
- explicit surface stack levels that match the new Glyph visual hierarchy
- reduced-motion tuned duration groupings

### Existing typography issues

- `tokens.css` still exposes `--font-display: "Space Grotesk"` even though the target system should primarily standardize on Geist and Geist Mono.
- existing screens still mix mono, sans, and display roles too freely
- some buttons and labels use letter-spacing as decoration instead of as a semantic micro-label system

### Existing motion issues

- current fast duration is `80ms`, which is too abrupt for some state transitions and not aligned with the requested 100 to 120ms band
- multiple transitions are still inline and not tokenized
- older scale and fade behaviors remain scattered across components and screens

## 10. Raw visual-literal inventory

### Files containing hard-coded hex colors

- `src/lib/appearance.ts`
- `src/screens/receive/payment-link-screen.tsx`
- `src/screens/receive/receive-screen.tsx`
- `src/screens/settings/diagnostics-screen.tsx`
- `src/screens/settings/support-screen.tsx`
- `src/styles/tokens.css`

### Files containing rgba color literals

- `src/components/bottom-nav.tsx`
- `src/components/modal.tsx`
- `src/components/sheet.tsx`
- `src/screens/dashboard/dashboard-screen.tsx`
- `src/screens/receive/receive-screen.tsx`
- `src/screens/send/burn-screen.tsx`
- `src/screens/send/send-many-screen.tsx`
- `src/screens/send/send-screen.tsx`
- `src/screens/settings/audit-log-screen.tsx`
- `src/screens/settings/diagnostics-screen.tsx`
- `src/screens/settings/support-screen.tsx`
- `src/screens/setup/create-vault-screen.tsx`
- `src/screens/stake/stake-screen.tsx`
- `src/screens/vaults/vaults-screen.tsx`
- `src/styles/global.css`
- `src/styles/tokens.css`

### Files containing arbitrary pixel literals

The following files contain one-off pixel values that need either tokenization or an explicit optical-correction justification:

- `src/components/address-suggestions.tsx`
- `src/components/animated-container.tsx`
- `src/components/bottom-nav.tsx`
- `src/components/button.tsx`
- `src/components/contact-picker.tsx`
- `src/components/detail-row.tsx`
- `src/components/divider.tsx`
- `src/components/error-boundary.tsx`
- `src/components/input.tsx`
- `src/components/modal.tsx`
- `src/components/request/connect-preview.tsx`
- `src/components/request/sc-call-preview.tsx`
- `src/components/request/sign-message-preview.tsx`
- `src/components/request/transfer-preview.tsx`
- `src/components/request/verify-message-preview.tsx`
- `src/components/sheet.tsx`
- `src/components/tag.tsx`
- `src/components/title-bar.tsx`
- `src/layouts/animated-layout.tsx`
- `src/screens/dashboard/dashboard-screen.tsx`
- `src/screens/history/history-screen.tsx`
- `src/screens/history/tx-detail-screen.tsx`
- `src/screens/lock/lock-screen.tsx`
- `src/screens/receive/payment-link-screen.tsx`
- `src/screens/receive/receive-screen.tsx`
- `src/screens/request/request-screen.tsx`
- `src/screens/send/burn-screen.tsx`
- `src/screens/send/scheduled-transfers-screen.tsx`
- `src/screens/send/send-many-screen.tsx`
- `src/screens/send/send-screen.tsx`
- `src/screens/settings/audit-log-screen.tsx`
- `src/screens/settings/dapps-screen.tsx`
- `src/screens/settings/diagnostics-screen.tsx`
- `src/screens/settings/network-screen.tsx`
- `src/screens/settings/request-history-screen.tsx`
- `src/screens/settings/security-screen.tsx`
- `src/screens/settings/settings-screen.tsx`
- `src/screens/settings/support-screen.tsx`
- `src/screens/setup/create-vault-screen.tsx`
- `src/screens/setup/import-vault-screen.tsx`
- `src/screens/setup/welcome-screen.tsx`
- `src/screens/stake/stake-screen.tsx`
- `src/screens/vaults/vault-detail-screen.tsx`
- `src/screens/vaults/vaults-screen.tsx`
- `src/styles/global.css`
- `src/styles/tokens.css`

## 11. Current shell and visual-system findings

### Title bar

Current state:

- quiet custom controls are already present
- drag regions are explicit
- version and wordmark are already shown subtly

Needs migration:

- tokenize title bar height and control sizing
- standardize hover and focus states through semantic tokens
- verify no interactive element is accidentally included in drag region after restyling

### Bottom navigation

Current state:

- floating pill surface
- blur and translucent panel
- active pill background animation
- icon-only nav with hidden or absent visible labels

Needs migration:

- shift from floating decorative object to quieter anchored nav surface
- preserve hide behavior when sheets are open
- keep keyboard reachability and accessible names
- likely add more explicit label legibility within the compact height budget

### Headers

Current state:

- split between `ScreenHeader`, `SettingsPageHeader`, and screen-local bespoke headers
- mixed typography and back-control treatments

Needs migration:

- unify header semantics
- unify title typography
- unify action-slot behavior
- ensure consistent back affordance and pointer targets

### Sheets

Current state:

- already stack-safe and focus-aware after recent fixes
- visually still tied to the prior rounded-surface language

Needs migration:

- normalize sheet header, body, footer, divider rhythm, close affordance, elevation, and action hierarchy
- remove decorative softness where it conflicts with the new system

### Buttons and inputs

Current state:

- usable but still too tied to pill-heavy, high-letterspacing styling
- buttons still vary between shared primitive and hand-rolled controls
- inputs skew too technical everywhere because mono is overused

Needs migration:

- define a canonical button family with stable heights and widths
- separate normal form inputs from technical-input cases
- introduce canonical icon button and text button patterns

## 12. Highest-risk migration hotspots

### 1. Vault management overlays

`vaults-screen.tsx` and `vault-detail-screen.tsx`

Reason:

- highest sheet density in the app
- mixture of sensitive actions, account management, exports, password rotation, and watch-only flows
- many opportunities for visual inconsistency if migrated piecemeal

### 2. Request approval flow

`request-screen.tsx` plus request preview components

Reason:

- security-sensitive
- multiple request types
- equal prominence needed for approve and reject
- dense technical detail that must remain legible in a narrow portrait window

### 3. Transaction composition flows

`send-screen.tsx`, `send-many-screen.tsx`, `burn-screen.tsx`, `stake-screen.tsx`

Reason:

- heavy state branching
- validation and review complexity
- inline suggestion lists and warning panels currently use raw style literals

### 4. History and analytics

`history-screen.tsx`, `tx-detail-screen.tsx`, `analytics-screen.tsx`

Reason:

- dense information hierarchy
- mixed loading, empty, and pagination states
- recent performance work needs visual integration, not regression

### 5. Setup and lock

`splash-screen.tsx`, `lock-screen.tsx`, `welcome-screen.tsx`, `create-vault-screen.tsx`, `import-vault-screen.tsx`

Reason:

- first-run brand impression
- trust and security language matter most here
- these screens still carry the old visual identity most obviously

## 13. Existing strengths to preserve

The migration should keep these product strengths intact while replacing the visual language:

- compact portrait-window discipline is already present
- route code splitting is already implemented
- sheet behavior is already much safer than before
- request flow logic is already strongly structured
- hide-to-tray, updater, diagnostics, and notification infrastructure already exist
- font and accent preferences already persist
- the codebase already has enough component structure to refactor without a UI-framework rewrite

## 14. Inventory conclusions

The app does not need a logic rewrite. It needs a systematic visual and structural migration with the following emphasis:

1. foundation first: tokens, typography, motion, shell metrics, and primitives
2. shell next: title bar, headers, bottom nav, sheet rhythm, global loading and error states
3. high-risk flows next: setup, lock, dashboard, send, vaults, request
4. information flows after: history, analytics, contacts, search
5. settings and diagnostics last, once the shared primitives stabilize

The migration should treat the current codebase as a real product with many states already represented, not as a blank design canvas.
