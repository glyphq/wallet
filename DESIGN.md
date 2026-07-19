# Glyph Wallet Design System

Last updated: 2026-07-19

This document describes the current implemented Glyph Wallet UI system. It should track the code in:

- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/lib/appearance.ts`
- `src/layouts/**`
- `src/components/**`

The wallet is a compact portrait desktop application, not a stretched mobile UI and not a conventional landscape dashboard.

## 1. Product frame

Target window constraints:

- default `380 × 680`
- minimum `360 × 640`
- maximum `420 × 760`
- frameless Tauri window
- resizable within bounds
- not maximizable

The interface is designed for:

- mouse and trackpad pointer input
- hover states
- keyboard navigation
- visible focus states
- compact vertical rhythm
- bottom-sheet overlays where the product already relies on them

## 2. Design principles

Glyph Wallet should communicate:

- precision
- calm
- legibility
- local control
- predictable state

The system avoids:

- decorative gradients
- glassmorphism
- speculative-trading visual cues
- oversized shadows
- excessive rounded-card stacking
- animated ornament

The system prefers:

- alignment
- restrained surfaces
- clear borders
- strong typography
- explicit semantic state
- dense but readable layout

## 3. Typography

Canonical families:

- UI and display: `Geist`
- technical identifiers: `Geist Mono`

Runtime font variables:

- `--font-sans`
- `--font-mono`
- `--font-display`

`App.tsx` applies persisted font-pair preferences by writing these variables to `document.documentElement`. The default system now maps `--font-display` to the selected sans family rather than a decorative alternate display face.

Core size roles in `src/styles/tokens.css`:

- `--text-display`
- `--text-headline`
- `--text-title`
- `--text-section`
- `--text-body`
- `--text-body-compact`
- `--text-label`
- `--text-caption`
- `--text-mono-lg`
- `--text-mono-sm`

Line-height roles:

- `--leading-display`
- `--leading-title`
- `--leading-body`
- `--leading-compact`

Global defaults in `src/styles/global.css`:

- body uses `var(--font-sans)`
- body uses tabular numerals by default
- placeholders use tertiary text color
- `.font-mono` and `.font-display` remain available as explicit overrides

## 4. Color system

The wallet uses a predominantly monochrome dark shell with restrained accent usage.

Implemented semantic background tokens:

- `--color-bg-canvas`
- `--color-bg-base`
- `--color-bg-surface`
- `--color-bg-surface-2`
- `--color-bg-elevated`
- `--color-bg-subtle`
- `--color-bg-inset`
- `--color-bg-overlay`
- `--color-scrim`

Implemented semantic text tokens:

- `--color-text-display`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-tertiary`
- `--color-text-disabled`
- `--color-text-inverse`

Implemented border tokens:

- `--color-border-subtle`
- `--color-border-default`
- `--color-border-strong`

Implemented accent tokens:

- `--color-accent`
- `--color-accent-hover`
- `--color-accent-muted`
- `--color-accent-contrast`
- `--color-focus-ring`
- `--color-focus-ring-soft`

Implemented semantic state tokens:

- `--color-status-success`
- `--color-status-warning`
- `--color-status-error`
- `--color-status-info`

Implemented derived utility tokens:

- `--color-skeleton`
- `--color-chart-primary`
- `--color-chart-secondary`
- `--color-chart-grid`

## 5. Spacing, radii, and control metrics

Spacing scale:

- `--space-1` = 4
- `--space-2` = 8
- `--space-3` = 12
- `--space-4` = 16
- `--space-5` = 20
- `--space-6` = 24
- `--space-8` = 32
- `--space-10` = 40
- `--space-12` = 48
- `--space-16` = 64

Radii:

- `--radius-sharp`
- `--radius-control`
- `--radius-card`
- `--radius-sheet`
- `--radius-pill`

Control and shell heights:

- `--height-titlebar`
- `--height-header`
- `--height-button-lg`
- `--height-button-md`
- `--height-button-sm`
- `--height-input`
- `--height-nav`

Shell layout tokens:

- `--screen-padding`
- `--sheet-padding`
- `--safe-bottom-space`

The implemented viewport-tier padding behavior is:

- default root padding token = `16px`
- `380px+` = `20px`
- `420px+` = `24px`

## 6. Motion

Implemented motion tokens:

- `--duration-fast`
- `--duration-base`
- `--duration-slow`
- `--ease-out`

The system uses motion for:

- route continuity
- shell hover and state feedback
- sheet and content entrance
- progress and skeleton states

Global CSS keeps existing utility keyframes for:

- `spin`
- `fade-in-up`
- `fade-in`
- `slide-down`
- `scale-in`
- `skeleton-pulse`
- `success-flash`
- `shake`

Reduced-motion behavior is enforced globally in `src/styles/global.css`.

## 7. Shell architecture

### Title bar

Implemented in `src/components/title-bar.tsx`.

Current design rules:

- frameless custom bar
- subtle surface and divider
- quiet wordmark plus version label
- minimize and close controls only
- drag region preserved
- fullscreen hides the bar

### Header shell

Implemented through:

- `src/layouts/animated-layout.tsx`
- `src/layouts/header-slot.tsx`
- `src/components/screen-header.tsx`
- `src/components/settings-page-header.tsx`

Current design rules:

- top header height is tokenized
- header padding uses `--screen-padding`
- screen headers use icon back controls and centered titles
- settings page headers reuse the main screen-header primitive

### Navigation shell

Implemented in:

- `src/layouts/animated-layout.tsx`
- `src/components/bottom-nav.tsx`

Current design rules:

- nav is anchored in flow, not floating over content
- nav uses visible labels
- active state uses restrained accent-muted background and accent text
- inactive hover remains quiet and readable
- nav hides while sheets are open

### App shell scrolling

Implemented in `src/layouts/app-shell.tsx`.

Current design rules:

- screens scroll within the main pane, not on the body
- scroll position is restored per route key
- shell padding uses `--screen-padding`
- the old hard-coded bottom-nav overlap padding has been removed in favor of anchored nav layout

## 8. Overlay system

The primary overlay primitive is `Sheet`.

Implemented in `src/components/sheet.tsx` with supporting state in `src/layouts/sheet-state.tsx`.

Current design rules:

- sheet overlays trap focus
- Escape closes the active sheet
- focus returns correctly
- stacked sheets isolate the background and only the topmost sheet is interactive
- the product remains sheet-first

`src/components/modal.tsx` still exists, but the current route surface uses sheets instead of modal dialogs.

## 9. Core shared primitives

### Button

Implemented in `src/components/button.tsx`.

Current design rules:

- semantic variants: `primary`, `secondary`, `ghost`, `danger`
- size roles: `lg`, `md`, `sm`
- default shape is now the sharper control style
- loading state preserves button width and replaces content with a spinner overlay

### Input

Implemented in `src/components/input.tsx`.

Current design rules:

- label, error, and right-element support
- tokenized focus ring and error ring behavior via `.glyph-input`
- optional `technical` mode to opt into mono presentation when a field is identifier-heavy
- standard fields now default to the sans UI treatment

### Error boundary

Implemented in `src/components/error-boundary.tsx`.

Current design rules:

- production fallback hides raw render stacks
- development fallback still exposes debugging detail
- runtime issues are still recorded for diagnostics

## 10. Appearance compatibility

Appearance persistence compatibility remains driven by `src/lib/appearance.ts` and `App.tsx`.

Current compatibility rules:

- persisted font-pair settings still remap to runtime CSS variables
- custom schemes still derive a full compatible CSS-variable set
- new semantic tokens are included in `CUSTOM_SCHEME_VARS` so clearing a custom scheme restores defaults cleanly

## 11. In-progress migration note

This document now reflects the implemented foundation and shell. Screen-level migration across setup, lock, dashboard, vaults, transactions, history, requests, and settings is still in progress and should update this document as shared patterns stabilize further.
