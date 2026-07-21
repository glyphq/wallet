# Glyph Wallet UI Migration Plan

Last updated: 2026-07-19
Branch: `feat/ui-improvements`

This plan is the execution contract for the complete end-to-end migration from the current Phantom-inspired wallet UI to the new Glyph brand and interface system. It is intentionally implementation-focused.

## 1. Migration principles

### Product constraints to preserve

The migration must preserve:

- all existing routes
- all transaction and signing behavior
- all existing vault and persistence structures
- deep-link request validation and callback flows
- updater, auto-lock, hide-to-tray, notifications, and diagnostics behavior
- Tauri security boundaries and Rust-owned sensitive operations
- current preference persistence for fonts, accents, and custom schemes unless semantically remapped

### Product qualities to improve

The migration must improve:

- visual hierarchy
- typography discipline
- screen rhythm and spacing density
- shared component consistency
- keyboard reachability and focus visibility
- loading, empty, error, pending, and retry states
- transaction comprehension
- small-window efficiency
- cross-platform shell polish
- overall coherence of the product language

### Non-goals

The migration will not:

- rewrite business logic for styling convenience
- introduce a generic UI framework
- invent major new wallet features
- weaken security behavior or request-review behavior
- replace existing brand assets with generated substitutes

## 2. Baseline facts shaping the implementation

### Window and shell constraints

From `src-tauri/tauri.conf.json`:

- default window: `380 × 680`
- min window: `360 × 640`
- max window: `420 × 760`
- frameless desktop window
- resizable within that band
- not maximizable

Implementation consequence:

- treat the UI as a compact portrait desktop application
- keep hover, focus, copy, tooltip, and keyboard affordances
- avoid wasting vertical space with decorative container stacking

### Current architectural leverage

- route code splitting already exists
- `AnimatedLayout` already centralizes header and nav chrome
- `Sheet` is already the dominant overlay primitive
- appearance persistence is already centralized enough to refactor safely through token mappings

Implementation consequence:

- migrate foundations and shell first, then push the new system through screens using existing structure

## 3. Execution stages

## Stage A. Baseline, inventory, and artifacts

### Deliverables

- `docs/ui-migration-inventory.md`
- `docs/ui-migration-plan.md`
- baseline validation results
- baseline screenshot matrix

### Actions

1. Run required validation commands before changes.
2. Enumerate routes, screens, overlays, components, and literal-style hotspots.
3. Confirm brand assets and Tauri constraints.
4. Capture baseline screenshots at:
   - `360 × 640`
   - `380 × 680`
   - `420 × 760`
5. Continue directly into implementation.

### Completion criteria

- inventory and plan docs exist
- baseline checks recorded
- screenshot harness path chosen and documented

## Stage B. Foundation

### Files primarily affected

- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/lib/appearance.ts`
- `src/App.tsx`
- `src/components/button.tsx`
- `src/components/input.tsx`
- new or expanded shared primitives as needed
- root `DESIGN.md`

### Foundation work

1. Replace the current token set with a fuller semantic token system.
2. Keep existing font and accent persistence working through remapped semantic variables.
3. Standardize typography around:
   - Geist for UI and display
   - Geist Mono for technical values
4. Add missing tokens for:
   - shell heights
   - icon sizes
   - screen padding by viewport tier
   - focus ring
   - divider hierarchy
   - skeletons
   - chart tones
   - semantic status layers
   - z-index layers
   - motion duration families
5. Reduce raw color dependence outside token and appearance files.
6. Create a root `DESIGN.md` that reflects the actual implemented system.

### Expected outcomes

- no component should depend on raw palette knowledge
- focus states, hover states, and disabled states become consistent
- shell spacing and safe areas become token-driven
- form and button primitives become predictable enough to reuse everywhere

## Stage C. Application shell

### Files primarily affected

- `src/components/title-bar.tsx`
- `src/components/bottom-nav.tsx`
- `src/components/screen-header.tsx`
- `src/components/settings-page-header.tsx`
- `src/components/sheet.tsx`
- `src/components/modal.tsx`
- `src/components/error-boundary.tsx`
- `src/layouts/animated-layout.tsx`
- `src/layouts/app-shell.tsx`
- `src/layouts/full-page.tsx`
- `src/layouts/header-slot.tsx`
- `src/layouts/sheet-state.tsx`

### Shell work

1. Quiet and tighten the title bar while preserving drag regions and platform controls.
2. Replace the floating-nav look with a quieter anchored navigation surface.
3. Normalize all header variants around one structural system.
4. Standardize sheet surface, header, footer, actions, spacing, and elevation.
5. Normalize global loading and route fallback presentation.
6. Normalize error fallback presentation.
7. Introduce consistent shell padding and safe-bottom spacing tokens.
8. Decide whether `modal.tsx` remains part of the canonical overlay set or is retired.

### Expected outcomes

- the entire app shell stops looking like a set of independently styled screens
- navigation, overlay, and focus behavior remain intact while the visual language changes globally

## Stage D. Core wallet flows

### Files primarily affected

- `src/screens/splash/splash-screen.tsx`
- `src/screens/lock/lock-screen.tsx`
- `src/screens/setup/*.tsx`
- `src/screens/dashboard/dashboard-screen.tsx`
- `src/screens/vaults/*.tsx`
- `src/screens/send/*.tsx`
- `src/screens/stake/stake-screen.tsx`
- `src/screens/receive/*.tsx`

### Flow work

1. Rebuild splash, setup, and lock around clear trust language and real brand assets.
2. Rework dashboard hierarchy around identity, balance, actions, and useful activity.
3. Rework vault screens around dense, calm scanning and cleaner account management.
4. Rework send flows into a consistent top-to-bottom composition structure.
5. Rework destructive and staking flows so risk is legible without theatrics.
6. Rework receive and payment-link surfaces around QR clarity, full address access, and copy confidence.

### Expected outcomes

- the most-used wallet flows no longer visually belong to the old system
- transaction review and approval flows become easier to understand in the narrow portrait window

## Stage E. Information and integration flows

### Files primarily affected

- `src/screens/history/*.tsx`
- `src/screens/contacts/contacts-screen.tsx`
- `src/screens/search/search-screen.tsx`
- `src/screens/request/request-screen.tsx`
- `src/components/request/*.tsx`
- `src/screens/settings/dapps-screen.tsx`
- `src/screens/settings/request-history-screen.tsx`

### Flow work

1. Rework history rows, filters, and details for stable hierarchy and scanability.
2. Rework analytics framing to be restrained and legible.
3. Rework contacts and search into cleaner compact list and result systems.
4. Rework request approval UI to emphasize exact action, affected identity, technical detail disclosure, and equal reject/approve affordance.
5. Rework connected dApp and request history management views to match the new information system.

### Expected outcomes

- informational screens become dense but calm
- request review becomes one of the strongest trust surfaces in the product

## Stage F. Settings and system flows

### Files primarily affected

- `src/screens/settings/*.tsx`
- settings-related shared components
- diagnostics and updater presentation

### Flow work

1. Rework settings home into grouped list architecture with stronger value visibility.
2. Normalize drill-down settings pages around one page-header and section pattern.
3. Rework diagnostics for machine-readable scanning and copying.
4. Rework support and about-style states so brand is present but restrained.
5. Rework audit log and security pages so semantic color is used only for real state meaning.

### Expected outcomes

- settings become one coherent system rather than a mix of isolated pages
- diagnostics retain density without using the old ad hoc style language

## Stage G. QA, screenshots, cleanup, and final validation

### Validation matrix

The final pass must rerun:

- `bun install`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `cargo check --manifest-path src-tauri/Cargo.toml --locked`
- `bun run release:check`
- `bun tauri dev` where available

### QA tasks

1. Walk every route.
2. Walk every major state branch.
3. Verify 360, 380, and 420 width behavior.
4. Verify keyboard navigation and focus restoration.
5. Verify reduced motion.
6. Verify font, accent, and custom-scheme persistence.
7. Verify title bar and drag regions.
8. Verify no content is obscured by shell chrome.
9. Capture after screenshots matching the baseline matrix.
10. Remove dead CSS and no-longer-needed duplicate primitives.

### Completion criteria

- all required checks are green
- all routes and overlays are on the new system
- the app reads as one coherent product

## 4. Shared-system decisions to implement

These are the design-system decisions this migration will implement in code.

### Typography

- default UI family: Geist
- default technical family: Geist Mono
- remove decorative dependence on Space Grotesk in the core shell
- use tabular numerals consistently for balances, amounts, dates, ticks, and metrics

### Color and surface hierarchy

- predominantly monochrome shell and surfaces
- restrained accent reserved for focus, active state, and primary emphasis
- semantic colors only for semantic state
- replace decorative translucency and blur with tone, border, and spacing hierarchy where possible

### Spacing and density

- use a disciplined scale of `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`
- standardize screen padding by viewport tier
- reduce unnecessary card stacking
- keep key actions reachable in the narrow window without mobile-style oversizing

### Motion

- fade and small-translation motion only where it clarifies continuity
- no theatrical spring behavior
- reduced-motion safe defaults

### Component discipline

- no raw colors inside normal components
- no per-screen reinvention of icon buttons, headers, or section patterns
- use shared primitives as the migration backbone

## 5. Concrete implementation order

The migration will proceed in the following order to minimize regression risk:

1. **Foundation tokens and primitives**
   - tokens
   - global CSS
   - appearance mappings
   - button and input families
   - shell metrics
2. **Shell and overlay migration**
   - title bar
   - bottom nav
   - headers
   - sheet
   - error and loading shells
3. **Trust-critical entry and request flows**
   - splash
   - lock
   - welcome/setup
   - request approvals
4. **Core transacting flows**
   - dashboard
   - vaults
   - send
   - send many
   - burn
   - stake
   - receive
5. **Information flows**
   - history
   - tx detail
   - analytics
   - contacts
   - search
6. **Settings and diagnostics**
   - settings home
   - security
   - audit log
   - network
   - notifications
   - support
   - diagnostics
7. **Final cleanup and screenshots**

## 6. Known implementation risks

### Risk: visual-only changes drift into logic churn

Mitigation:

- keep changes concentrated in tokens, shared primitives, and screen layout structure
- only touch logic when a UI integration needs a minimal type-safe adjustment

### Risk: vault and request overlays become inconsistent mid-migration

Mitigation:

- migrate shell and canonical `Sheet` behavior before reworking high-overlay screens

### Risk: existing preference persistence breaks

Mitigation:

- treat `src/lib/appearance.ts` and `App.tsx` variable application as compatibility boundaries
- remap semantic tokens rather than removing persisted settings

### Risk: screenshot capture is blocked by environment differences

Mitigation:

- prefer the Tauri app where available
- otherwise run the Vite renderer for the required viewport matrix and document the method used

## 7. Immediate next implementation step

The next concrete step after these docs is:

1. replace and expand `src/styles/tokens.css`
2. migrate `src/styles/global.css`
3. update appearance token mappings in `src/lib/appearance.ts`
4. normalize the shared button, input, title bar, bottom nav, and header primitives against the new token set

That foundation work will then unlock the screen-by-screen migration without duplicating styling decisions in each route.
