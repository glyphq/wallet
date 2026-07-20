# Glyph Wallet Design System

Status: working-tree proposal, pending approval
Last updated: 2026-07-19

This document describes the current proposed Glyph Wallet design system as implemented in the working tree.

Primary source files:

- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/components/button.tsx`
- `src/components/icon-button.tsx`
- `src/components/input.tsx`
- `src/components/screen-header.tsx`
- `src/components/bottom-nav.tsx`
- `src/components/title-bar.tsx`
- `src/components/sheet.tsx`
- `src/components/shell-vault-switcher.tsx`
- `src/layouts/animated-layout.tsx`

## 1. Product frame

Glyph Wallet is a compact portrait desktop wallet.

Target shell:

- default `380 × 680`
- minimum `360 × 640`
- maximum `420 × 760`
- frameless Tauri window
- keyboard and pointer first
- calm, high-clarity, low-ornament UI

The system is not mobile-first. It should feel like precise desktop software in a narrow frame.

## 2. Design intent

The UI should communicate:

- precision over personality
- calm over spectacle
- clear state over decoration
- local control over abstraction
- trust through maintenance quality

The visual system should feel:

- monochrome first
- typography-led
- dense but breathable
- infrastructural rather than promotional

We avoid:

- decorative gradients
- glow effects
- floating card stacks everywhere
- theatrical motion
- oversized pills
- bright semantic colors used as decoration

We prefer:

- consistent baseline rhythm
- subdued surfaces
- hairline borders
- explicit state labels
- compact action rows
- stable shell structure

## 3. Typography

Canonical families:

- UI and display: `Geist`
- technical values: `Geist Mono`

Runtime font variables:

- `--font-sans`
- `--font-mono`
- `--font-display`

Hierarchy roles:

- `--text-display` for balances and major value states
- `--text-headline` for major screen hero lines
- `--text-title` for major panels
- `--text-section` for shell headers and section anchors
- `--text-body` for primary reading text
- `--text-body-compact` for dense rows
- `--text-label` for labels, nav captions, and control metadata
- `--text-caption` for secondary helper text
- `--text-mono-lg` and `--text-mono-sm` for identifiers and machine-like values

Rules:

- tabular numerals by default in the app shell
- mono only for addresses, hashes, ticks, and raw values
- no decorative display face switching inside one screen
- stronger weight before smaller gray text

## 4. Token system

### 4.1 Backgrounds

Core surfaces:

- `--color-bg-base`
- `--color-bg-surface`
- `--color-bg-surface-2`
- `--color-bg-elevated`
- `--color-bg-subtle`
- `--color-bg-inset`
- `--color-bg-overlay`

Shell-specific surfaces:

- `--color-bg-header`
- `--color-bg-nav`
- `--color-bg-input`
- `--color-bg-hover`
- `--color-bg-press`

### 4.2 Text

- `--color-text-display`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-tertiary`
- `--color-text-disabled`
- `--color-text-inverse`

### 4.3 Borders

- `--color-border-subtle`
- `--color-border-default`
- `--color-border-strong`
- `--color-border-contrast`

### 4.4 Accent and semantic state

Accent:

- `--color-accent`
- `--color-accent-hover`
- `--color-accent-muted`
- `--color-accent-contrast`
- `--color-focus-ring`
- `--color-focus-ring-soft`

Semantic state:

- `--color-status-success`
- `--color-status-warning`
- `--color-status-error`
- `--color-status-info`
- `--color-status-success-soft`
- `--color-status-warning-soft`
- `--color-status-error-soft`
- `--color-status-info-soft`

### 4.5 Layout and metrics

Spacing:

- `--space-1` through `--space-16`

Radii:

- `--radius-sharp`
- `--radius-control`
- `--radius-card`
- `--radius-sheet`
- `--radius-pill`

Heights:

- `--height-titlebar`
- `--height-header`
- `--height-button-lg`
- `--height-button-md`
- `--height-button-sm`
- `--height-input`
- `--height-nav`

Shell metrics:

- `--screen-padding`
- `--sheet-padding`
- `--safe-bottom-space`

Motion and depth:

- `--duration-fast`
- `--duration-base`
- `--duration-slow`
- `--ease-out`
- `--shadow-elevated`
- `--shadow-focus`

## 5. Shared shell rules

### Title bar

The title bar is quiet and infrastructural.

Rules:

- no heavy divider
- low-contrast shell surface
- lowercase wordmark
- mono version label
- only essential window controls

### App header

The app header is shared across shell-managed routes.

Rules:

- left edge can host the active vault switcher
- center-left title is always the current page title only
- no page-specific custom top bars on normal app routes
- page-specific controls should move into content unless they are globally relevant

### Vault switcher

The shell header includes the active vault avatar.

Rules:

- use the vault identicon derived from `vault.id` and `vault.color`
- clicking opens a compact switch sheet
- watch-only vaults switch immediately
- encrypted vaults prompt for password inside the switch sheet
- successful switching returns the user to the dashboard to avoid stale route context

### Bottom navigation

The bottom nav is anchored and quiet.

Rules:

- integrated surface, not a floating bubble bar
- active item uses restrained surface shift plus a thin accent marker
- labels remain visible
- targets stay at least 44px usable

## 6. Shared component rules

### Button

Variants:

- `primary`
- `secondary`
- `ghost`
- `danger`

Rules:

- primary uses the accent sparingly
- secondary is the default utility action
- ghost is for low-emphasis inline shell actions
- danger is semantic only
- loading preserves width
- hover changes are calm, not springy

### IconButton

Rules:

- transparent by default
- hover uses subtle surface wash
- no direct inline mouse mutation behavior
- badge remains reserved for real alerts only

### Input

Rules:

- dedicated input surface token
- stronger label weight
- focus uses tokenized focus shadow
- hover slightly lifts contrast without changing layout

### Sheet

Rules:

- tokenized sheet padding
- title uses section-level typography, not tiny muted text
- scrim uses semantic shell token
- rounded top corners only
- elevation comes from tone and shadow, not glow

## 7. Global interaction classes

Defined in `src/styles/global.css`:

- `.glyph-btn`
- `.glyph-input`
- `.glyph-icon-btn`
- `.glyph-surface`
- `.glyph-panel`
- `.skeleton`

These classes provide shared motion, hover, focus, and density behavior. Components may still use inline token references, but interaction behavior should be centralized here where practical.

## 8. Motion rules

Motion remains functional.

Used for:

- route continuity
- sheets
- loading states
- state confirmation

Not used for:

- ornament
- large spatial choreography
- spring-heavy playful movement

Reduced motion remains globally enforced.

## 9. Accessibility rules

The system assumes:

- visible focus rings everywhere
- labels on fields
- named icon-only buttons
- 44px minimum practical targets for critical controls
- keyboard and screen-reader operability for sheets and shell controls
- semantic colors used only for meaning

## 10. Current design-system direction

This pass aims to make the wallet feel more like one product by:

- consolidating the shell header
- reintroducing the vault context as a compact shared switcher instead of page-specific chrome
- tightening spacing and corner radii
- reducing control noisiness
- moving toward calmer, more infrastructural surfaces
- keeping the accent sparse and intentional

## 11. Approval checkpoint

This design-system pass is intentionally uncommitted.

Approval should evaluate:

- header composition
- vault switcher behavior
- nav weight and density
- button and input tone
- sheet tone and hierarchy
- title bar quietness
- overall coherence with the Glyph brief
