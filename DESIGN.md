# Glyph Design System

The definitive visual and interaction language for the Glyph wallet. Every screen, component, and interaction must follow these guidelines. No exceptions without explicit justification.

---

## 1. Identity

Glyph is a **self-custody crypto wallet** for the Qubic network. The design language is:

- **Dark-native** — built for dark environments, never ships a light mode
- **Confident** — minimal chrome, generous whitespace, content speaks
- **Precise** — monospace for data, sans for prose, no ambiguity
- **Quiet** — the interface disappears; the user's financial data is the focus

The closest reference is Phantom wallet: clean dark surfaces, floating navigation, minimal borders, content-first layout. Glyph differentiates through its accent color (cyan, not purple) and its monospace-first data display.

---

## 2. Color

### Surfaces

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-base` | `#0F0F0F` | Page background. The darkest value. |
| `--color-bg-elevated` | `#161618` | Cards, sheets, modals. One step above base. |
| `--color-bg-surface` | `#282828` | Interactive surfaces: inputs, list items on hover. |
| `--color-bg-subtle` | `#2c2c2e` | Dividers, subtle fills, disabled backgrounds. |

### Text

| Token | Hex | Usage |
|---|---|---|
| `--color-text-display` | `#ffffff` | Headlines, hero numbers, primary CTAs. |
| `--color-text-primary` | `#ffffff` | Body text on dark surfaces. Same value as display, different semantic use. |
| `--color-text-secondary` | `#a8a8ac` | Labels, descriptions, metadata. |
| `--color-text-disabled` | `#5a5a5e` | Placeholder text, timestamps, tertiary info. |

### Accent

| Token | Hex | Usage |
|---|---|---|
| `--color-accent` | `#ccfcfb` | Active states, links, focus rings, the one bright color. Used sparingly. |

The accent is **never** used for large fills. It marks the current selection, an active tab, or a focused input. Overuse kills it.

### Status

| Token | Hex | Usage |
|---|---|---|
| `--color-status-success` | `#34c759` | Confirmed transactions, positive balances. |
| `--color-status-warning` | `#f59e0b` | Pending states, caution required. |
| `--color-status-error` | `#ff3b30` | Failed actions, destructive confirmations. |

Status colors are **data encoding only**. Never use them for decoration, borders, or backgrounds unless indicating actual state.

### Vault Accents

| Token | Hex |
|---|---|
| `--color-vault-slate` | `#64748b` |
| `--color-vault-red` | `#ef4444` |
| `--color-vault-amber` | `#f59e0b` |
| `--color-vault-emerald` | `#10b981` |
| `--color-vault-sky` | `#0ea5e9` |
| `--color-vault-violet` | `#8b5cf6` |

Vault colors are assigned per vault for visual distinction. They appear in identicons and subtle accents, never as page-level fills.

### Borders

| Token | Value | Usage |
|---|---|---|
| `--color-border-strong` | `#2c2c2e` | Card borders, input borders, visible dividers. |
| `--color-border-subtle` | `rgba(255,255,255,0.05)` | Section separators, list item dividers. |

**Rule:** Borders are structural, not decorative. If a card has a background difference from its parent, it does not need a border. If two sections need separation, use `--color-border-subtle`.

---

## 3. Typography

### Fonts

| Role | Font | Weights | Usage |
|---|---|---|---|
| Display | **Doto** | 400 | App name ("GLYPH"), hero numbers. Used once per screen max. |
| Sans | **Geist** | 400, 500, 600 | All prose: labels, descriptions, button text, navigation. |
| Mono | **Geist Mono** | 400, 700 | Data: addresses, amounts, hashes, tick numbers, timestamps. |

### Scale

| Token | Size | Usage |
|---|---|---|
| `--text-display` | 3rem (48px) | Hero balance on dashboard. |
| `--text-headline` | 1.5rem (24px) | Screen titles (in screen header). |
| `--text-body` | 0.9375rem (15px) | Default body text. |
| `--text-label` | 0.75rem (12px) | Labels, metadata, secondary info. |
| `--text-mono-lg` | 1rem (16px) | Large data values (amounts in tx detail). |
| `--text-mono-sm` | 0.6875rem (11px) | Addresses, tick numbers, compact data. |
| `--text-caption` | 0.6875rem (11px) | Same size as mono-sm, used for caption text in sans. |

### Rules

1. **Sentence case everywhere.** No ALL CAPS except for 3-letter currency codes (QU, USD). No Title Case.
2. **Mono for data, sans for prose.** If it's a number, address, hash, or code — mono. If it's a word, sentence, or label — sans.
3. **Doto for the app name only.** Never use Doto for body text, labels, or data.
4. **No text-transform: uppercase.** Remove it from all labels, buttons, and headers. Sentence case is the default.
5. **Line height:** 1.3-1.4 for headings, 1.5 for body, 1.6-1.8 for mono data blocks.
6. **Letter spacing:** Tight (`-0.01em` to `-0.02em`) for sans headings. Normal for body. Slightly open (`0.04em` to `0.08em`) for mono data.

---

## 4. Spacing

### Scale

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Tight gaps (icon + text in pills). |
| `--space-2` | 8px | Default gap in flex rows, list item internal padding. |
| `--space-3` | 12px | Gap between related items (label + input). |
| `--space-4` | 16px | Card padding, section internal padding. |
| `--space-6` | 24px | Gap between sections. |
| `--space-8` | 32px | Page padding (horizontal). |
| `--space-12` | 48px | Large section gaps, hero spacing. |
| `--space-16` | 64px | Page-level vertical breathing room. |

### Rules

1. **4px base unit.** All spacing is a multiple of 4px. No 5px, 7px, 13px values.
2. **Related items closer, unrelated items farther.** A label and its input are `--space-3` apart. Two separate form sections are `--space-6` apart.
3. **Page padding:** `--space-4` (16px) horizontal on all pages. `--space-4` top when header is present.
4. **Card padding:** `--space-4` (16px) all sides.
5. **Bottom padding for nav:** Pages with bottom nav need 76px extra bottom padding (pb-76) to prevent content from hiding under the floating nav.

---

## 5. Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sharp` | 4px | Inputs, small buttons, tags, data cards. |
| `--radius-card` | 16px | Sheets, modals, large cards, the bottom-nav pill. |
| `--radius-pill` | 9999px | Fully rounded: nav pill, status badges, toggle tracks. |

**Rule:** Use `--radius-sharp` by default. Use `--radius-card` only for floating elements (sheets, modals, nav). Use `--radius-pill` only for pill shapes.

---

## 6. Components

### Buttons

| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| Primary | `--color-text-display` (white) | `--color-bg-base` (dark) | none | Main CTA per screen. One primary button visible at a time. |
| Secondary | transparent | `--color-text-primary` | `--color-border-strong` | Alternative actions, form submissions. |
| Ghost | transparent | `--color-text-secondary` | none | Tertiary actions, cancel buttons, inline links. |
| Danger | transparent | `--color-status-error` | `--color-status-error` | Destructive actions (delete, remove). |

- **Height:** lg=48px, md=40px, sm=32px.
- **Shape:** pill (default) for primary/secondary, sharp for inline actions.
- **Loading state:** Show a 16px spinner, disable the button. Never change the button text.
- **Disabled state:** 40% opacity. No cursor change.

### Inputs

- Background: `--color-bg-surface`.
- Border: 1px `--color-border-strong`.
- Border radius: `--radius-sharp`.
- Label: sans, `--text-label`, uppercase tracking 0.05em, `--color-text-secondary`.
- Error text: sans, `--text-caption`, `--color-status-error`.
- Placeholder: `--color-text-disabled`.

### Sheets (Bottom Sheets)

- Background: `--color-bg-elevated`.
- Border: 1px `--color-border-strong` on top edge.
- Border radius: `--radius-card` top corners only.
- Max height: 80vh.
- Drag handle: 36px wide, 3px tall, `--color-border-strong`, centered.
- Title: sans, `--text-label`, `--color-text-secondary`, uppercase tracking 0.08em.
- Close button: "✕", `--color-text-disabled`, ghost style.
- Animation: slide up 24px + fade in, 200ms ease-out.

**Rule:** Use Sheets for all bottom-origin interactions: action menus, pickers, confirmations, forms. Use Modals only for critical confirmations that need centered presentation (delete vault).

### Cards / List Items

- Background: transparent (on base) or `--color-bg-elevated` (on surface).
- Border: 1px `--color-border-strong` if needed for structure. Many list items need no border — use spacing alone.
- Padding: `--space-3` to `--space-4`.
- Active/selected state: `--color-bg-elevated` background, accent dot or highlight.
- Hover state: not used on desktop (no hover in wallet UX). Focus via keyboard if needed.

### Identicons

- Always use the Identicon component for identity visualization.
- Seeds: vault ID + color for vaults, identity string for accounts.
- Sizes: 32px (compact), 36px (list items), 40px (detail views).
- Radius: 6-8px (sharp, not pill).

### Tags / Badges

- Border: 1px `--color-border-strong`.
- Background: transparent.
- Text: sans, 10px, `--color-text-disabled`.
- Radius: `--radius-pill`.
- Padding: 1px 6px.

---

## 7. Navigation

### Bottom Nav

- Floating, centered, 85% opacity dark backdrop with blur.
- 6 tabs: Home, Send, Receive, Earn, History, Settings.
- Active tab: `--color-accent` icon with animated pill background.
- Inactive tabs: `--color-text-secondary`.
- **Hides when any Sheet is open.** (Implemented via sheet-state context.)

### Screen Header

- Fixed at top of AppShell, 44px height.
- Left: "← back" in mono, `--color-text-secondary`.
- Center: title in mono, uppercase, `--color-text-primary`.
- Right: action button (if any).
- Border bottom: 1px `--color-border-subtle`.

### Route Hierarchy

- `/` → splash → `/lock` or `/dashboard`
- `/dashboard` → main view
- `/send`, `/receive`, `/earn` → action screens
- `/history`, `/analytics`, `/contacts` → history tab
- `/vaults`, `/vaults/:id`, `/vaults/:id/portfolio` → vault management
- `/settings/*` → settings screens
- `/setup`, `/setup/create`, `/setup/import` → onboarding

---

## 8. Interaction Patterns

### Sheets Over Modals

Prefer Sheets for all dialogs except:
- **Delete confirmations** (centered Modal with danger styling).
- **Password rotation** (Modal with multi-step form).

Everything else: action menus, pickers, rename forms, import flows, seed reveal → Sheet.

### Navigation Direction

- Forward: no animation (instant, content fades in 120ms).
- Back: no animation (instant).
- Sheet open: slide up 24px + fade, 200ms ease-out.
- Sheet close: slide down 24px + fade, 150ms ease-out (faster exit).

### Loading States

- Button loading: inline spinner, button disabled.
- Page loading: skeleton or "Loading..." text, not full-screen spinners.
- Data fetching: show stale data if available, refresh indicator if updating.

### Error Handling

- Inline errors below the relevant field.
- No toast notifications for form errors.
- Sentence case, no exclamation marks.
- Tell the user what to do: "Wrong password — 3 attempts remaining" not "ERROR: AUTH FAILED".

---

## 9. Copywriting

### Rules

1. **Sentence case** for all UI text. No ALL CAPS except currency codes.
2. **No trailing periods** on labels, buttons, or short messages.
3. **Be specific:** "3 accounts · Unlocked 2h ago" not "ACCOUNTS: 3".
4. **Use arrows** (→) for address notation: "100 QU → ABCD...XYZ".
5. **Friendly but not casual:** "Wrong password" not "Oops! Wrong password."
6. **No jargon without context:** "Seed" is fine for crypto users. "SC call" needs no expansion.
7. **Action-oriented buttons:** "Unlock", "Send", "Reveal seed" — not "Submit", "OK", "Yes".
8. **Time format:** "Just now", "5m ago", "2h ago", "3d ago". No full timestamps in lists.

### Notification Copy

| Kind | Title | Body |
|---|---|---|
| received | Funds received | `{amount} QU` |
| sent | Funds sent | `{amount} QU → {shortAddr}` |
| confirmed | Transaction confirmed | `{amount} QU confirmed on chain` |
| failed | Transaction failed | `{amount} QU → {shortAddr}` |
| expired | Transaction expired | `{amount} QU → {shortAddr}` |

---

## 10. Security Considerations

### Display

- **Never display full seeds** in normal flow. Reveal only in a Sheet with password/biometric confirmation, auto-dismiss after timeout.
- **Truncate identities** in lists: show first 6 + last 4 characters. Full identity on detail screen only.
- **No clipboard auto-read.** Write-only clipboard with timed clear.
- **Password fields** always use `type="password"` with `autoComplete="current-password"` or `"new-password"`.

### State

- **Lock screen blocks all routes** except `/lock` and `/setup`.
- **Session data** (seeds, passwords) lives only in session store, never persisted.
- **Vault data** is encrypted at rest. Password never stored.

### Audit

- Log all security-relevant actions: unlock, seed reveal, vault export, vault delete.
- Show audit log in settings for user transparency.

---

## 11. Accessibility

- **Minimum contrast:** 4.5:1 for body text, 3:1 for large text and UI components.
- **Focus rings:** 2px `--color-accent` on all interactive elements when focused via keyboard.
- **Touch targets:** Minimum 44×44px for all interactive elements.
- **Reduced motion:** Respect `prefers-reduced-motion`. Disable sheet animations, fade transitions.
- **Screen readers:** All icon-only buttons must have `aria-label`. All images need alt text.
- **Keyboard navigation:** Tab order matches visual order. Escape closes sheets/modals.

---

## 12. What We Never Do

- ❌ Light mode or theme switching
- ❌ Emoji as icons (use Solar icons)
- ❌ ALL CAPS for labels or descriptions (only currency codes)
- ❌ `fontFamily: "var(--font-mono)"` for non-data text
- ❌ Raw hex values in component styles (use CSS variables)
- ❌ Hover-only interactions (desktop wallet, but still no hover-dependent UX)
- ❌ Borders on everything (use spacing and background contrast)
- ❌ Loading spinners blocking entire screens
- ❌ Error messages without actionable guidance
- ❌ Toast notifications for form validation
- ❌ Modal for anything a Sheet can handle
- ❌ Text-transform: uppercase on any element
