---
"glyph": major
---

Overhaul Glyph around the generated Glyph API, redesigned wallet and multisig flows, and a separate notification window.

- **Network and data:** Route chain reads, contract queries, broadcasts, and live updates through the generated Glyph API client. Remove the official RPC dependency. Drive ticks, prices, market data, identity activity, balances, and confirmation resolution from Glyph SSE feeds, with polling only as a fallback. Migrate network settings from separate live/archive URLs to one HTTPS API origin and clear cached data when that origin changes.
- **Balances:** Use the newest indexed or peer head for target ticks, refresh balances after broadcast and resolution, add a periodic balance fallback, and surface the live streamed tick above the dashboard balance.
- **Wallet:** Rename the vault domain to wallet, centralize account switching in the page header, add a full-screen account selector and account pages, and allow deleting wallets from the switch screen.
- **Accounts:** Remove account notes, tags, and hidden-account controls. Simplify account editing, preserve legacy data safely, and add a hold-to-copy seed action that reads from the native session and verifies the selected identity.
- **Backups:** Export and import wallet metadata together with contacts and transaction memos.
- **Multisig:** Add complete MSVault list, create, detail, deposit, release, approvals, and approval flows. Include owner and asset views, fee handling, holding-fee warnings, pending-approval notches, explorer links, and review steps.
- **Send:** Format amounts while typing, preserve fiat precision, show the resulting remaining balance, add a balance refresh action, add a review back action, and add icons to recipient and amount inputs.
- **History:** Rebuild transaction detail in an explorer-style layout, group history rows by day, align grouped labels with rows, add contract and identity marks, copyable transaction IDs, explorer links, status treatment, and local transaction notes.
- **Notifications:** Replace native OS notifications with a separate custom Tauri notification window. Add configurable position, duration, and maximum-visible count; animated cards; natural-language copy; dapp request details; explorer navigation; and a custom dismiss control. Keep notifications available while the wallet is locked when enabled.
- **UX and design:** Switch the interface to Space Grotesk, use Gravity icons, redesign the title bar and primary navigation in a flatter action style, remove bottom sheets in favor of full-screen flows, and refine onboarding, splash, history, send, vault, and asset displays.
- **Security and reliability:** Keep signing and seed copy native, guard copied seeds against session identity mismatches, verify clipboard ownership before clearing, preserve biometric fallbacks, resolve confirmations from lifecycle checks after stream interruptions, and retain single-instance deep-link behavior.
- **Removed:** QEarn staking, burn, and Send Many flows; account notes, tags, and hiding; bottom sheets; the native notification plugin and its Windows vendor patch.
