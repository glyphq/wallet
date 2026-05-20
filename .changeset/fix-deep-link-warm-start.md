---
"sigil": patch
---

Fix deep link warm-start, updater feedback, and enable DevTools.

- Deep link warm-start: when Sigil is already running and a `sigil://` link is clicked, the single-instance callback now processes the URL and brings the window to focus; previously the URL was silently dropped
- Updater: check result now shows `[UP TO DATE]` when no update is available, and `[UPDATE CHECK FAILED]` in red when the check throws (network error, etc.); errors were previously swallowed silently
- DevTools enabled in production builds (`devtools: true`) so right-click → Inspect works in the installed app
