---
"sigil": patch
---

Fix overflow in diagnostics and support screens

- Diagnostics: InfoRow value spans now have `flex: 1; min-width: 0; overflow-wrap: break-word` so long RPC URLs and error messages wrap correctly inside their cards
- Diagnostics: Section cards use `overflow: hidden` as a containment guard
- Support: Attribution note text (long uppercase monospace) gets `overflow-wrap: break-word`
- Support: SponsorSheet and DiscordSheet bottom sheets now have `max-height: 85dvh; overflow-y: auto` so they cannot exceed the viewport on short windows
