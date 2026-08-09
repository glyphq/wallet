<div align="center">

<img src="src/assets/brand/glyph-on-light.png#gh-light-mode-only" alt="Glyph" width="120" />
<img src="src/assets/brand/glyph-on-dark.png#gh-dark-mode-only" alt="Glyph" width="120" />

# Glyph

**A self-custodial desktop wallet for Qubic.**

Create and organize Vaults, manage accounts, move QU, explore Qubic activity, and approve dApp requests from one focused desktop application.

[![Release](https://img.shields.io/github/v/release/glyphq/wallet?style=flat-square&color=0d0d0d&labelColor=1a1a1a)](https://github.com/glyphq/wallet/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/glyphq/wallet/ci.yml?branch=main&style=flat-square&label=CI&color=0d0d0d&labelColor=1a1a1a)](https://github.com/glyphq/wallet/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-0d0d0d?style=flat-square&labelColor=1a1a1a)](./LICENSE)

Windows x64 · macOS Universal · Linux x86_64

[**Download Glyph**](https://github.com/glyphq/wallet/releases/latest) · [User guide](./docs/USER_GUIDE.md) · [Contributing](./CONTRIBUTING.md) · [Discord](https://discord.gg/s5qNRNGu96)

</div>

---

## One desktop home for Qubic

Glyph keeps the everyday Qubic workflow clear and local:

- **Your Vaults, your control.** Create or import Vaults, organize accounts, and keep your wallet data on your device.
- **A focused transaction flow.** Send, receive, burn, track activity, manage contacts, and review each action before it is submitted.
- **Built for the Qubic ecosystem.** Work with live balances, assets, history, payment links, QEarn, contracts, and dApp requests in one native app.
- **Personal by default.** Choose light or dark mode, select an interface font, hide balances when needed, and tailor each Vault to your workflow.

## What you can do

### Vaults and accounts

- Create a new Vault, import a Qubic seed, or restore a Glyph Vault export.
- Keep multiple Vaults and up to 16 accounts in each, with names, colors, icons, and account management tools.
- Switch between Vaults and accounts quickly from the application shell.
- View QU, owned assets, approximate fiat values, and account activity at a glance.

### Send, receive, and use Qubic

- Send QU to an identity, a saved contact, or multiple recipients at once.
- Share an identity, QR code, or payment link to receive QU.
- Follow a transaction from broadcast through confirmation, failure, or expiry.
- Burn QU, work with QEarn positions, and interact with supported Qubic contracts.
- Save transfer templates and choose when to send them.

### Stay organized

- Search and filter transaction history by direction, type, amount, date, or tick range.
- Add contacts, local memos, and tags to keep frequent activity easy to find.
- Explore Vault analytics, counterparties, contract use, and activity trends.
- Use diagnostics, notifications, and update controls without leaving Glyph.

### Connect with dApps

Glyph handles `glyph://` payment links and dApp requests from the desktop. Connections, transfers, contract calls, and message requests are presented in the app for review before you choose whether to continue. Manage approved dApps and their permissions from Settings.

For integration details, see the [User guide](./docs/USER_GUIDE.md#14-external-requests-and-glyph-links).

## Download and install

Get the latest stable build from [GitHub Releases](https://github.com/glyphq/wallet/releases/latest).

| Platform | Download | Install |
| --- | --- | --- |
| Windows x64 | `Glyph_*_x64-setup.exe` | Run the per-user installer |
| macOS, Apple Silicon and Intel | `Glyph_*_universal.dmg` | Open the DMG and move Glyph to Applications |
| Linux x86_64 | `Glyph_*_amd64.AppImage` | Make it executable, then run it |
| Debian / Ubuntu x86_64 | `Glyph_*_amd64.deb` | `sudo apt install ./Glyph_*_amd64.deb` |
| Fedora / RHEL-compatible x86_64 | `Glyph-*.x86_64.rpm` | `sudo dnf install ./Glyph-*.x86_64.rpm` |

### Run the AppImage

```sh
chmod +x Glyph_*_amd64.AppImage
./Glyph_*_amd64.AppImage
```

AppImage installations support Glyph's in-app update path. Debian and RPM installations are updated through the same system package workflow used to install them.

## Get started

1. Download Glyph from the [official releases page](https://github.com/glyphq/wallet/releases/latest).
2. Create a new Vault or import an existing Qubic seed or Glyph Vault export.
3. Back up the seed for every new Vault before continuing.
4. Fund an account, share its identity, or start exploring the Qubic network.

Read the [User guide](./docs/USER_GUIDE.md) for walkthroughs covering Vaults, transactions, QEarn, contacts, history, dApps, and settings.

## Build from source

Glyph is built with React, TypeScript, Rust, and Tauri v2.

```sh
git clone https://github.com/glyphq/wallet.git
cd wallet
bun install --frozen-lockfile
bun tauri dev
```

Use Bun `1.3.14` and Rust `1.88.0`. Platform prerequisites, validation commands, and release guidance are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Resources

- [User guide](./docs/USER_GUIDE.md)
- [Changelog](./CHANGELOG.md)
- [Contributing](./CONTRIBUTING.md)
- [Release notes](https://github.com/glyphq/wallet/releases)
- [Discord](https://discord.gg/s5qNRNGu96)

## License

[MIT](./LICENSE)
