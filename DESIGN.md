# Glyph Wallet Design System

Status: implemented and maintained

Last reviewed: 2026-07-30

This document defines the maintained design direction for Glyph. It is a contribution guide, not a frozen catalog of every CSS value. When documentation and implementation diverge, treat the following files as the current source of truth and update this document with the code:

- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/layouts/animated-layout.tsx`
- `src/layouts/app-shell.tsx`
- `src/components/title-bar.tsx`
- `src/components/screen-header.tsx`
- `src/components/bottom-nav.tsx`
- `src/components/shell-vault-switcher.tsx`
- `src/components/button.tsx`
- `src/components/icon-button.tsx`
- `src/components/input.tsx`
- `src/components/sheet.tsx`

## Product frame

Glyph is compact desktop software presented in a narrow portrait window. It is not a mobile page embedded in a desktop shell.

The configured window is:

- default: `380 × 680`
- minimum: `360 × 640`
- maximum: `420 × 760`
- frameless and resizable within those bounds
- keyboard and pointer first

Every screen must remain understandable and operable at `360 × 640`. Extra width should improve breathing room through the tokenized screen padding, not introduce a different information architecture.

## Design character

Glyph should communicate:

- precision over novelty
- calm over spectacle
- explicit state over decoration
- local control over abstraction
- trust through legibility and maintenance quality

The visual language is dark, monochrome-first, typography-led, compact, and infrastructural. Wallet accent colors identify wallets; semantic colors communicate status. Neither is general decoration.

Prefer:

- one clear visual hierarchy per screen
- stable shell structure
- subdued surfaces and hairline borders
- compact action rows with explicit labels
- whitespace that separates tasks rather than filling the window
- visible progress, validation, and recovery states

Avoid:

- decorative gradients, glows, and glass effects
- layers of interchangeable floating cards
- oversized controls that consume the compact viewport
- bright status colors without semantic meaning
- page-specific header systems
- motion that delays or disguises state changes
- one-off values when an existing token or component expresses the same role

## System architecture

The design system has four layers:

1. **Foundations** in `src/styles/tokens.css`: color, type, spacing, radius, control height, motion, shadow, shell, and z-index variables.
2. **Global behavior** in `src/styles/global.css`: reset rules, focus treatment, interaction states, shared classes, keyframes, and reduced-motion overrides.
3. **Shared components and layouts** in `src/components/` and `src/layouts/`: reusable behavior, structure, accessibility, and component variants.
4. **Product screens** in `src/screens/`: task-specific composition built from the first three layers.

Keep dependencies flowing in that direction. Screens may compose shared primitives, but shared primitives must not depend on a specific route. A repeated route-level pattern should move downward into a shared component rather than be copied.

## Foundations

### Color

The current application is dark-only. `:root` in `tokens.css` defines the supported palette.

Use tokens by purpose:

- `--color-bg-*` for canvas, surfaces, overlays, inputs, hover, and pressed states
- `--color-text-*` for display, primary, secondary, tertiary, disabled, and inverse text
- `--color-border-*` for hierarchy and separation
- `--color-accent*` for primary emphasis and focus
- `--color-status-*` for success, warning, error, and information
- `--color-wallet-accent-*` only for wallet identity
- derived chart, QR, scrim, and skeleton tokens for those specific contexts

Do not copy a hexadecimal or `rgb()` value from the token file into a component. Reuse its semantic token. Add a new token only when the role is reusable and cannot be represented accurately by an existing one.

Semantic color must not be the only signal. Pair it with text, an icon, or both.

### Typography

Canonical families:

- display: `Boldonse` through `--font-display`
- interface and body: `Geist` through `--font-sans`
- technical values: `Geist Mono` through `--font-mono`

Use display type sparingly for short, intentional headlines. Use Geist for controls, labels, prose, and longer titles. Use Geist Mono for addresses, hashes, ticks, fixed-width identifiers, and raw machine values, not for ordinary explanatory copy.

Use the type-scale tokens in `tokens.css` rather than route-specific font sizes. The scale covers display values, headlines, titles, sections, body copy, compact rows, labels, captions, and technical values. Preserve tabular numerals for balances and other changing numeric data.

Hierarchy should come from role, weight, spacing, and contrast before resorting to smaller gray text. Critical instructions and errors must remain comfortably readable.

### Spacing and sizing

The spacing scale runs from `--space-1` through `--space-16`. Shell and control dimensions are separately tokenized.

Rules:

- align neighboring content to the shared screen-padding edge
- use the spacing scale for layout gaps and padding
- keep primary controls at their shared heights
- preserve at least a 44-pixel practical target for critical and icon-only actions
- do not shrink controls to solve an information-architecture problem
- keep scroll ownership explicit; normal routes use `AppShell` as the scrolling content region

### Shape and depth

Radii distinguish controls, cards, sheets, windows, and pills. Use the corresponding token instead of choosing a new radius by sight.

Depth comes from surface tone, borders, and restrained shadows. Use elevation to communicate stacking or modality, not to make every region look interactive.

## Shell and navigation

### Title bar

The frameless title bar is operating-system chrome. Keep it quiet, compact, and limited to branding, version context, drag behavior, and essential window controls. It must not compete with the product header.

### Shared header

`AnimatedLayout` owns the normal route header. Route titles and back targets are derived centrally, while `AppShell` can supply route-specific status content through the shared header slot.

Rules:

- use `ScreenHeader` rather than creating a route-specific top bar
- show the active vault switcher on top-level shell routes
- use a back action for subordinate routes
- keep global context in the header and task-specific actions in the content area
- update the central route mapping when adding a new shell route

### Vault switcher

The shared switcher communicates active vault context. It uses the wallet's configured identity treatment, handles locked-vault authentication, and returns to the dashboard after switching so stale route context is not shown under a new wallet.

Do not duplicate wallet-switch controls inside individual screens unless the task is explicitly about managing vaults.

### Bottom navigation

The bottom navigation is anchored shell chrome, not a floating bubble bar. Labels stay visible, active state remains restrained, and targets stay usable in the minimum window.

`AnimatedLayout` hides it on routes that own their navigation and whenever a sheet is open. New overlays must participate in the shared sheet state rather than covering an active navigation bar independently.

## Shared components

### Buttons

`Button` supports:

- variants: `primary`, `secondary`, `ghost`, `danger`
- sizes: `lg`, `md`, `sm`
- loading and disabled states

Use one primary action for the current decision. Secondary is the default utility action. Ghost is for low-emphasis inline or shell actions. Danger is reserved for destructive behavior.

Loading must preserve layout and disable repeated submission. Do not imitate a button with a clickable `div`.

### Icon buttons

Use `IconButton` for genuinely icon-only actions. Every instance needs an accessible name. Badges are for real unread or alert state, not decoration.

### Inputs

Use the shared input components for labels, helper text, errors, prefixes, suffixes, disabled state, and consistent field geometry. An error must explain what the user can do next. Placeholder text is not a replacement for a label.

Financial inputs must preserve exact values. Do not silently round, coerce, or reformat user input in a way that can change the transaction.

### Sheets

`Sheet` is the standard modal surface. It provides dialog semantics, application isolation, stacked-sheet handling, initial focus, focus trapping, Escape dismissal, and focus restoration.

Rules:

- provide a concise title when the purpose is not otherwise named
- keep one decision or short task per sheet
- use the footer for persistent actions
- keep destructive confirmation explicit
- nest sheets only when the workflow genuinely requires another modal task
- do not bypass the component with a custom fixed overlay

### Surfaces and loading

Use `.glyph-surface`, `.glyph-panel`, and `.skeleton` for their intended roles. Skeletons should approximate the final layout and only appear while content is expected. Prefer a useful empty state when no content exists and an actionable error state when loading failed.

## Screen composition

A normal screen should answer, in order:

1. Where am I and which wallet is active?
2. What is the primary value, state, or task?
3. What action is available now?
4. What secondary detail or recovery path is needed?

Keep major actions near the content they affect. Avoid separating a label, current value, and edit action across unrelated surfaces.

For transaction and signing review:

- show the action type and selected account clearly
- present destination, amount, tick, contract, payload, or message data before approval
- distinguish claimed dApp metadata from verified transaction facts
- keep reject and approve actions visually unambiguous
- never use animation or truncation to hide security-relevant differences

Addresses and hashes may be visually truncated in lists when the full value remains available through detail or copy behavior. Use monospace styling for technical identifiers and preserve exact copied values.

## State design

Every asynchronous feature should account for:

- idle
- loading
- success
- empty result
- recoverable error
- blocked or locked state
- stale or partially hydrated data when applicable

Do not leave an action apparently enabled when required data is missing. Preserve form input after recoverable failures unless retaining it would expose a secret.

Success feedback should confirm what happened without trapping the user. Errors should name the failed operation, avoid leaking secrets, and offer a safe next step.

## Motion

Motion is functional. Use it for route continuity, sheet entry and exit, loading, and state confirmation. Keep transitions short and avoid spring-heavy or large spatial choreography.

The global reduced-motion media query collapses animation and transition durations and disables skeleton, stagger, flash, and shake effects. New motion must respect the same preference. A feature must remain understandable when all animation is effectively removed.

## Accessibility

At minimum:

- preserve visible `:focus-visible` treatment
- use native controls and semantic headings
- label every field and icon-only action
- keep critical targets practically usable at 44 pixels or larger
- maintain logical tab and reading order
- announce time-sensitive state where appropriate
- keep sheets keyboard operable and restore focus on close
- pair color with text or icon meaning
- keep text and essential controls legible at the minimum window size

Do not add positive `tabIndex` values to repair DOM order. Fix the structure instead.

## Maintaining the system

When changing shared UI:

1. Identify the semantic role before changing a visual value.
2. Reuse or extend a token rather than hard-coding a route-specific value.
3. Change the shared component when the behavior belongs to every instance.
4. Update all affected states, including keyboard, loading, disabled, error, and reduced motion.
5. Test representative screens at `360 × 640`, `380 × 680`, and `420 × 760`.
6. Test pointer and keyboard operation, sheet focus behavior, long text, large numeric values, and empty/error states.
7. Update this document when the maintained direction or component contract changes.

A shared-design change is complete when the code and documentation agree, existing routes remain coherent, and no new one-off system has been introduced alongside the old one.
