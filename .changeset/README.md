# Changeset Style

Write changesets as release-note inputs, not as commit logs.

## Rules

- Write for users, not maintainers.
- Lead with visible outcomes.
- Group related changes under short themes like `Security`, `Wallet`, `UX`, or `Reliability`.
- Avoid file names, internal refactors, and implementation details unless users need them.
- Prefer 1-2 changesets per release cycle, not one changeset per commit.
- Keep the summary tight: one short intro sentence and 3-5 bullets.

## Template

```md
---
"glyph": patch
---

Improve [area] across [high-level themes].

- **Security:** [user-facing security improvement]
- **Wallet:** [user-facing wallet behavior improvement]
- **Reliability:** [stability or correctness improvement]
- **UX:** [visible interface or workflow improvement]
```

## Good Examples

### Security + Export

```md
---
"glyph": patch
---

Improve wallet safety and export behavior.

- **Security:** Hardened deep-link callbacks and request handling to reduce spoofing, replay, and unsafe network edge cases.
- **Privacy:** Encrypted persisted app metadata and fail closed if protected store data cannot be read safely.
- **UX:** Request review flows now behave more predictably during modal and focus transitions.
- **Export:** Contacts and vault backups now use the native save dialog.
```

### Rust Vault + Session Hardening

```md
---
"glyph": patch
---

Strengthen vault handling and signing safety.

- **Wallet:** Moved vault cryptography into the Rust backend and reduced exposure of sensitive unlock material.
- **Security:** Tightened deep-link, callback, and endpoint validation for safer request handling.
- **Privacy:** Reduced secret exposure in the UI by hiding unrevealed seed data until explicitly shown.
- **Reliability:** Added stricter validation and sanitization around exports, notifications, and persisted transaction state.
```

## Avoid

- "refactor x, y, z"
- long lists of internal fixes
- commit-title phrasing
- mixed unrelated changes with no grouping
- raw implementation details like module names unless they affect users directly
