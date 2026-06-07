---
"sigil": patch
---

Fix balance not showing and Linux AppImage deep link registration

- Fix balance always displaying as `—` on any vault with fewer than 16 accounts: `GetBalances16` always returns 16 slots regardless of how many public keys were sent, so the response length check was comparing 16 against the account count and throwing on every poll
- Fix `sigil://` deep links not working after installing the AppImage: rewrite `Exec=` in the registered `.desktop` file to point to the AppImage file itself (not the extracted binary inside the AppDir which only exists while mounted), and call `xdg-mime default` to set Sigil as the default handler in `mimeapps.list` (which is what GNOME and KDE actually consult — `update-desktop-database` alone was not enough)
- Re-register automatically if the AppImage has been moved since the last launch so deep links stay functional
