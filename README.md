<div align="center">

<img src="src/assets/brand/glyph-on-light.png#gh-light-mode-only" alt="Glyph Wallet" width="120" />
<img src="src/assets/brand/glyph-on-dark.png#gh-dark-mode-only" alt="Glyph Wallet" width="120" />

# Glyph Wallet

### Your Qubic wallet for the desktop.

**Glyph is an open-source, self-custodial desktop wallet for Qubic.**
Create wallets, manage Qubic addresses, send and receive QU, follow your activity, and review requests from connected apps in one focused native application.

[![Latest release](https://img.shields.io/github/v/release/glyphq/wallet?style=flat-square&color=0d0d0d&labelColor=1a1a1a)](https://github.com/glyphq/wallet/releases/latest)
[![Release downloads](https://img.shields.io/github/downloads/glyphq/wallet/latest/total?style=flat-square&label=downloads&color=0d0d0d&labelColor=1a1a1a)](https://github.com/glyphq/wallet/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/glyphq/wallet/ci.yml?branch=main&style=flat-square&label=CI&color=0d0d0d&labelColor=1a1a1a)](https://github.com/glyphq/wallet/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0d0d0d?style=flat-square&labelColor=1a1a1a)](#download-and-install)
[![License](https://img.shields.io/badge/license-MIT-0d0d0d?style=flat-square&labelColor=1a1a1a)](./LICENSE)

[**Download Glyph**](https://github.com/glyphq/wallet/releases/latest) · [User guide](./docs/USER_GUIDE.md) · [Discord](https://discord.gg/s5qNRNGu96) · [Contributing](./CONTRIBUTING.md)

</div>

---

## Start here

1. [Download the latest release](https://github.com/glyphq/wallet/releases/latest) for your desktop.
2. Create a wallet, import a Qubic seed, or restore a Glyph wallet backup.
3. Back up every new seed offline before you add funds or continue.

> **Your wallet, your recovery.** Glyph is self-custodial. It cannot recover a seed or reset a forgotten wallet password.

## Why Glyph

| | What it gives you |
| --- | --- |
| **Your wallets, organized** | Create or import wallets, keep Qubic accounts together, and make them easy to recognize with names, colors, and icons. |
| **QU without the guesswork** | Send to an address or contact. Receive with a QR code or copyable address. Review the amount and remaining balance before you sign. |
| **Activity with context** | Searchable history, local memos, contacts, saved transfer templates, backup exports, and account-level activity make your wallet easier to understand over time. |
| **Multisig when you need it** | Create shared vaults, manage owners, deposit funds and assets, request releases, and review pending approvals from the dashboard header. |
| **Connected apps on your terms** | Open supported `glyph://` requests from Qubic apps and services, then review connection, transfer, contract-call, signing, and verification requests in Glyph. |

## Built for everyday Qubic

### Keep your setup in one place

A wallet can hold the Qubic addresses you use every day. Switch wallets and accounts from anywhere in the app, hide balances when you need privacy, and choose the display settings that fit your workspace.

Your dashboard keeps balances, the live network tick, recent activity, owned assets, and approximate fiat values close at hand. Use a custom Glyph API origin when you need to work with a different Glyph service.

### Send, receive, and stay informed

- Send QU to an address or a saved contact.
- Share an address or QR code to receive QU.
- Track transactions from broadcast through confirmation, expiry, or failure.
- Keep local transaction memos and reusable transfer templates for recurring payments.

### Review requests before they happen

Glyph can receive supported deep links from connected Qubic apps and services. Requests are shown in the wallet so you can inspect the relevant account, action, amount, and details before choosing to continue or decline.

Every request is reviewed individually. Connecting a dApp shares only the selected address and never pre-authorizes future actions. The requested permission list is echoed to the dApp for wire compatibility but is not stored or enforced by the wallet. Read [External requests and Glyph links](./docs/USER_GUIDE.md#14-external-requests-and-glyph-links) for request behavior and limitations.

## Download and install

Get the latest stable build from [GitHub Releases](https://github.com/glyphq/wallet/releases/latest).

| Platform | Download | Install |
| --- | --- | --- |
| Windows x64 | `Glyph_*_x64-setup.exe` | Run the per-user installer. |
| macOS, Apple Silicon and Intel | `Glyph_*_universal.dmg` | Open the DMG and move Glyph to Applications. |
| Linux x86_64 | `Glyph_*_amd64.AppImage` | Make it executable, then run it. |
| Debian / Ubuntu x86_64 | `Glyph_*_amd64.deb` | `sudo apt install ./Glyph_*_amd64.deb` |
| Fedora / RHEL-compatible x86_64 | `Glyph-*.x86_64.rpm` | `sudo dnf install ./Glyph-*.x86_64.rpm` |

### Run the AppImage

```sh
chmod +x Glyph_*_amd64.AppImage
./Glyph_*_amd64.AppImage
```

Glyph is a native desktop application. It does not run in a browser, on mobile, or on 32-bit systems. See the [system requirements and Linux notes](./docs/USER_GUIDE.md#2-supported-desktop-platforms) before installing on a new machine.

## Self-custody, clearly

- Your encrypted Wallets and local wallet data are stored on your computer.
- Glyph does not upload your seed or Wallet password to a Glyph account or recovery service.
- Your seed is the recovery method. Store it offline, keep it private, and test backups before you need them.
- Wallet backups are sensitive encrypted files. Store them separately from their passwords.

For implementation details, platform behavior, and important limitations, read the [full user guide](./docs/USER_GUIDE.md).

## Build from source

Glyph is built with React, TypeScript, Rust, and Tauri v2.

```sh
git clone https://github.com/glyphq/wallet.git
cd wallet
bun install --frozen-lockfile
bun tauri dev
```

Use Bun `1.3.14` and Rust `1.88.0`. Platform prerequisites, validation commands, and contribution guidance are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Project links

- [User guide](./docs/USER_GUIDE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Development](./docs/DEVELOPMENT.md)
- [Security policy](./SECURITY.md)
- [Contributing](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)
- [Release notes](https://github.com/glyphq/wallet/releases)
- [Discord](https://discord.gg/s5qNRNGu96)

## License

[MIT](./LICENSE)
