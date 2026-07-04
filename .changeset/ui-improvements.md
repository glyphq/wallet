---
"glyph": patch
---

Redesign settings screens, earn screen, onboarding, and overall UI polish.

- **Settings**: Rewrite all 10 settings screens with consistent card/flat-list design, shared SettingsPageHeader component
- **Earn**: Redesigned lock/unlock screen with account selector, epoch stats card, info tooltip, animated tab pill, position sorting, and icon-labeled tab buttons
- **Onboarding**: Rewrite create/import vault screens with inline accent pill buttons, transparent inputs, sentence case, motion transitions
- **Transaction detail**: Fix title centering, remove tags UI
- **Dashboard**: Comma-separated balance formatting with locale-independent output
- **Identicon**: Fix avatar rendering with proper border-radius clipping
- **Navigation**: Add Earn tab with MoneyBag icon, remove Settings from nav
- **Store**: Keep deprecated `txTags` field for migration compatibility
