# Native widgets

Glyph uses [`tauri-plugin-widgets` 0.5](https://s00d.github.io/tauri-plugin-widgets/) and its `tauri-plugin-widgets-api` package to render declarative native widget JSON. The application installs the JavaScript API with Bun, registers the Rust plugin, and scopes `widgets:default` to the main window and the fixed desktop widget label.

## Customize a widget

1. Open **Settings → Widgets**.
2. Start with the private default, or edit the JSON directly. The widget API accepts `small`, `medium`, and `large` layouts and the full plugin element set.
3. Select **Save & sync** to write the configuration to the platform widget transport.
4. On desktop, select **Open desktop widget** to preview the built-in renderer. The window is frameless, not shown in the taskbar, and can be closed from Settings.

The editor accepts up to 128 KB of valid JSON. It is intentionally a full declarative configuration, rather than a restricted theme form, so every supported plugin layout, text, image, shape, chart, and style property can be customized.

## Privacy

The default widget contains only static, privacy-safe text. Glyph does **not** automatically write balances, identities, addresses, transaction history, seeds, or passwords into widget storage.

Widget transports can be readable outside the locked main wallet window on some platforms. If you add wallet-derived information to custom JSON, treat it as visible information and understand the relevant platform's widget-storage model before syncing it.

## Platform setup

- **Linux and Windows desktop:** the built-in widget renderer works through a fixed `glyph-wallet-overview` window without copying a `widget.html` file.
- **macOS:** this repository configures the plugin's `widgetContainer` transport for ad-hoc desktop development. A signed/App Store WidgetKit distribution must switch to an App Group transport and include the generated macOS extension and entitlements. Use `bunx tauri-widgets init-macos --app-group group.com.qubic.glyph` on a macOS signing host.
- **iOS:** native WidgetKit requires an App Group, generated iOS extension files, and a paid Apple Developer account for physical devices. Run `bunx tauri-widgets init-ios` on the iOS host and configure `plugins.widgets.transport` as `appGroup`.
- **Android:** run the plugin's Android setup on an Android host. Configure the widget group to `group.com.qubic.glyph` in the native setup so it matches Glyph's synced configuration.
- **Windows native Widgets Board:** scaffold the provider with `bunx tauri-widgets init-windows`, then merge its MSIX/COM manifest additions as part of Windows packaging.

The app does not generate Apple, Android, or Windows platform-extension projects automatically in a cross-platform checkout. Those generated files are signing and platform-specific artifacts that must be reviewed and built on their target hosts.

## Validate

```sh
bun run typecheck
bun run test
TAURI_CONFIG='{"bundle":{"externalBin":[]}}' cargo check --manifest-path src-tauri/Cargo.toml --locked
```

For widget JSON preview without a Tauri build, use Bun directly:

```sh
bunx tauri-widgets preview ./widget.json --size small --watch
```
