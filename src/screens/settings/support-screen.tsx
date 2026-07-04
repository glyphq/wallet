import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { DONATION_IDENTITY } from "@/data/sponsors";
import { copyToClipboard } from "@/lib/clipboard";
import { formatQu } from "@/lib/format";
import { usePersistedStore } from "@/store/persisted";
import { Copy, Heart } from "@solar-icons/react";

const GITHUB_URL = "https://github.com/glyph-oss/glyph.app";

export default function SupportScreen() {
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copyAddress() {
    await copyToClipboard(DONATION_IDENTITY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sentTotal = pendingTxs
    .filter((tx) => tx.destination === DONATION_IDENTITY)
    .reduce((sum, tx) => sum + BigInt(tx.amount), 0n);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", paddingBottom: "calc(var(--space-4) + 76px)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Support" />

        {/* Help the project */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Heart size={20} weight="Outline" style={{ color: "var(--color-accent)" }} />
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                Help the project
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                Glyph is free and open source. Donations keep it running.
              </div>
            </div>
          </div>

          {/* QR toggle */}
          {showQr && (
            <div style={{
              display: "flex", justifyContent: "center",
              background: "#fff", borderRadius: "var(--radius-card)", padding: "var(--space-4)",
            }}>
              <QRCodeSVG value={DONATION_IDENTITY} size={160} bgColor="#ffffff" fgColor="#000000" level="L" />
            </div>
          )}

          {/* Address */}
          <div style={{
            background: "var(--color-bg-elevated)", borderRadius: "var(--radius-sharp)",
            padding: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-3)",
          }}>
            <span style={{
              flex: 1, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)",
              color: "var(--color-text-secondary)", wordBreak: "break-all", lineHeight: 1.4,
            }}>
              {DONATION_IDENTITY}
            </span>
            <motion.button {...gesture.pressSubtle} onClick={copyAddress} style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", padding: "var(--space-1)",
            }}>
              <Copy size={16} weight="Outline" style={{ color: copied ? "var(--color-status-success)" : "var(--color-text-disabled)" }} />
            </motion.button>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <motion.button
              {...gesture.pressSubtle}
              onClick={() => setShowQr((v) => !v)}
              style={{
                flex: 1, padding: "var(--space-3)", background: "transparent",
                border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                fontWeight: 500, color: "var(--color-text-secondary)",
              }}
            >
              {showQr ? "Hide QR" : "Show QR"}
            </motion.button>
            <motion.button
              {...gesture.press}
              onClick={copyAddress}
              style={{
                flex: 1, padding: "var(--space-3)", background: "var(--color-accent)",
                border: "none", borderRadius: "var(--radius-sharp)",
                cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                fontWeight: 500, color: "var(--color-bg-base)",
              }}
            >
              Copy address
            </motion.button>
          </div>

          {sentTotal > 0n && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
              {formatQu(sentTotal)} QU sent from this wallet
            </span>
          )}
        </Card>

        {/* GitHub */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                GitHub
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                Star the repo, report bugs, or contribute
              </div>
            </div>
            <motion.button
              {...gesture.pressSubtle}
              onClick={() => openUrl(GITHUB_URL)}
              style={{
                padding: "var(--space-2) var(--space-3)", background: "transparent",
                border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                fontWeight: 500, color: "var(--color-text-secondary)", flexShrink: 0,
              }}
            >
              Open
            </motion.button>
          </div>
        </Card>
      </motion.div>
    </AppShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "var(--space-3)",
      background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
      padding: "var(--space-4)",
    }}>
      {children}
    </div>
  );
}
