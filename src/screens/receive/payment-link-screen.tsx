import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle, LinkRound, QrCode } from "@solar-icons/react";
import { copyToClipboard } from "@/lib/clipboard";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { truncateId } from "@/lib/format";

const WEB_BASE = "https://wallet.glyphq.org/pay";
const QR_BG = "var(--color-qr-surface)";
const QR_FG = "var(--color-qr-ink)";

function buildLinks(to: string, amount: string, label: string) {
  const params = new URLSearchParams({ to });
  const amountNum = amount.trim().replace(/\D/g, "");
  if (amountNum && BigInt(amountNum) > 0n) params.set("amount", amountNum);
  if (label.trim()) params.set("label", label.trim());
  const query = params.toString();
  return {
    web: `${WEB_BASE}?${query}`,
    deep: `glyph://pay?${query}`,
  };
}

export default function PaymentLinkScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) =>
    s.vaults.find((v) => v.id === s.settings.activeVaultId),
  );
  const wallets = useSessionStore((s) => s.wallets);

  const defaultIdentity =
    getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets) ?? "";

  const [to, setTo] = useState(defaultIdentity);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [copiedDeep, setCopiedDeep] = useState(false);
  const [qrMode, setQrMode] = useState<"web" | "deep">("web");

  const links = useMemo(() => {
    if (!to.trim() || to.trim().length !== 60) return null;
    try {
      return buildLinks(to.trim().toUpperCase(), amount, label);
    } catch {
      return null;
    }
  }, [to, amount, label]);

  async function copy(text: string, which: "web" | "deep") {
    await copyToClipboard(text);
    if (which === "web") {
      setCopiedWeb(true);
      setTimeout(() => setCopiedWeb(false), 1500);
    } else {
      setCopiedDeep(true);
      setTimeout(() => setCopiedDeep(false), 1500);
    }
  }

  // Account selector — all visible accounts across the vault
  const accountOptions = useMemo(() => {
    if (!vault) return [];
    return vault.accounts
      .filter((a) => !a.hidden)
      .map((a) => ({
        name: a.name,
        identity: getVaultAccountIdentity(vault, a.index, wallets) ?? "",
      }))
      .filter((a) => a.identity.length === 60);
  }, [vault, wallets]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>

        {/* ── Account selector ── */}
        {accountOptions.length > 1 && (
          <div>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em", display: "block", marginBottom: "var(--space-2)" }}>
              Receive to
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {accountOptions.map((a) => (
                <button
                  key={a.identity}
                  type="button"
                  onClick={() => setTo(a.identity)}
                  style={{
                    background: to === a.identity ? "var(--color-text-primary)" : "none",
                    border: `1px solid ${to === a.identity ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
                    borderRadius: "var(--radius-sharp)",
                    cursor: "pointer",
                    padding: "var(--space-1) var(--space-3)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-label)",
                    fontWeight: 500,
                    color: to === a.identity ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  }}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Form card ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Input
            label="Amount (QU)"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder="Leave blank to let sender choose"
            inputMode="numeric"
            autoComplete="off"
          />
          <Input
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 100))}
            placeholder="e.g. Coffee, Invoice #42"
            autoComplete="off"
          />
        </div>

        {/* ── QR + links (only when valid) ── */}
        {links ? (
          <>
            {/* QR code */}
            <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: "var(--space-1)", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-sharp)", padding: 2 }}>
                {(["web", "deep"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setQrMode(mode)}
                    style={{
                      background: qrMode === mode ? "var(--color-bg-surface)" : "transparent",
                      border: "none",
                      borderRadius: "var(--radius-sharp)",
                      cursor: "pointer",
                      padding: "var(--space-1) var(--space-3)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-label)",
                      fontWeight: 500,
                      color: qrMode === mode ? "var(--color-text-primary)" : "var(--color-text-disabled)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {mode === "web" ? <LinkRound size={12} /> : <QrCode size={12} />}
                    {mode === "web" ? "Web" : "App"}
                  </button>
                ))}
              </div>

              {/* QR */}
              <div style={{ padding: "var(--space-4)", background: QR_BG, borderRadius: "var(--radius-card)" }}>
                <QRCodeSVG
                  value={qrMode === "web" ? links.web : links.deep}
                  size={200}
                  bgColor={QR_BG}
                  fgColor={QR_FG}
                  level="M"
                />
              </div>

              {/* Link preview */}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", wordBreak: "break-all", textAlign: "center", maxWidth: 280 }}>
                {qrMode === "web" ? links.web : links.deep}
              </span>
            </div>

            {/* Copy buttons */}
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <CopyButton
                label="Copy web link"
                copied={copiedWeb}
                onCopy={() => copy(links.web, "web")}
              />
              <CopyButton
                label="Copy app link"
                copied={copiedDeep}
                onCopy={() => copy(links.deep, "deep")}
              />
            </div>

            {/* Receiving identity */}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", textAlign: "center", display: "block" }}>
              Receiving to {truncateId(to, 8, 6)}
            </span>
          </>
        ) : (
          /* ── Empty state ── */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-8) 0", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-bg-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LinkRound size={22} style={{ color: "var(--color-text-disabled)" }} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
                Select an account to generate a link
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)" }}>
                Add an amount or label to pre-fill the payment
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}

// ── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ label, copied, onCopy }: { label: string; copied: boolean; onCopy: () => void }) {
  return (
    <Button
      variant={copied ? "secondary" : "secondary"}
      size="sm"
      shape="sharp"
      onClick={onCopy}
      style={{ flex: 1, color: copied ? "var(--color-accent)" : undefined }}
    >
      {copied ? (
        <>
          <CheckCircle size={14} />
          Copied
        </>
      ) : (
        <>
          <Copy size={14} />
          {label}
        </>
      )}
    </Button>
  );
}
