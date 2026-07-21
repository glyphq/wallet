import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { stepMotion, gesture, transition } from "@/lib/animations";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { DONATION_IDENTITY } from "@/data/sponsors";
import { copyToClipboard } from "@/lib/clipboard";
import { formatQu } from "@/lib/format";
import { usePersistedStore } from "@/store/persisted";
import { Heart, Copy, CheckCircle, Code, QrCode } from "@solar-icons/react";

const GITHUB_URL = "https://github.com/glyph-ecosystem/wallet";

// High-contrast pair required for QR readability
const QR_BG = "var(--color-qr-surface)";
const QR_FG = "var(--color-qr-ink)";

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
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Support" />

        {/* Hero card */}
        <div style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
          padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "var(--color-accent-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Heart size={20} weight="BoldDuotone" style={{ color: "var(--color-accent)" }} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>
                Support Glyph
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                Free and open-source wallet
              </div>
            </div>
          </div>

          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Donations help cover infrastructure and keep development going. Every contribution matters.
          </div>

          {/* Sent total */}
          {sentTotal > 0n && (
            <div style={{
              display: "flex", alignItems: "center", gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-status-success-soft)", borderRadius: "var(--radius-sharp)",
            }}>
              <CheckCircle size={14} weight="Bold" style={{ color: "var(--color-status-success)", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-status-success)" }}>
                {formatQu(sentTotal)} QU donated from this wallet
              </span>
            </div>
          )}
        </div>

        {/* QR code — animated */}
        <AnimatePresence>
          {showQr && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                display: "flex", justifyContent: "center", padding: "var(--space-4)",
                background: QR_BG, borderRadius: "var(--radius-card)",
              }}>
                <QRCodeSVG value={DONATION_IDENTITY} size={180} bgColor={QR_BG} fgColor={QR_FG} level="L" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Address + copy */}
        <div style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
          padding: "var(--space-3) var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)",
        }}>
          <span style={{
            flex: 1, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)",
            color: "var(--color-text-secondary)", wordBreak: "break-all", lineHeight: 1.4,
          }}>
            {DONATION_IDENTITY}
          </span>
          <motion.button {...gesture.pressSubtle} onClick={copyAddress} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-1)",
          }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={copied ? "copied" : "copy"}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={transition.quick}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--space-1)",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                  fontWeight: 500, color: copied ? "var(--color-status-success)" : "var(--color-text-secondary)",
                }}
              >
                {copied ? <CheckCircle size={12} weight="Bold" /> : <Copy size={12} weight="Linear" />}
                {copied ? "Copied" : "Copy"}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Actions row */}
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <motion.button
            {...gesture.pressSubtle}
            onClick={() => setShowQr((v) => !v)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
              padding: "var(--space-3)", background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
              cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              fontWeight: 500, color: "var(--color-text-secondary)",
            }}
          >
            <QrCode size={14} weight="Outline" />
            {showQr ? "Hide QR" : "Show QR"}
          </motion.button>
          <motion.button
            {...gesture.press}
            onClick={copyAddress}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
              padding: "var(--space-3)", background: "var(--color-text-display)",
              border: "none", borderRadius: "var(--radius-sharp)",
              cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              fontWeight: 500, color: "var(--color-bg-base)",
            }}
          >
            <Copy size={14} weight="Outline" />
            Copy address
          </motion.button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--color-border-subtle)" }} />

        {/* GitHub row */}
        <motion.button
          {...gesture.pressSubtle}
          onClick={() => openUrl(GITHUB_URL)}
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            width: "100%", background: "var(--color-bg-surface)", border: "none",
            cursor: "pointer", padding: "var(--space-4)", borderRadius: "var(--radius-card)",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: "var(--radius-sharp)",
            background: "var(--color-bg-elevated)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Code size={18} weight="Linear" style={{ color: "var(--color-text-primary)" }} />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              GitHub
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: 2 }}>
              Star, report bugs, or contribute
            </div>
          </div>
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
            color: "var(--color-text-secondary)",
          }}>
            Open
          </span>
        </motion.button>
      </motion.div>
    </AppShell>
  );
}
