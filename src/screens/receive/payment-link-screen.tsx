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

const sectionStyle = {
  borderTop: "1px solid var(--color-border-default)",
  paddingTop: "var(--space-4)",
} as const;

const eyebrowStyle = {
  display: "block",
  marginBottom: "var(--space-3)",
  color: "var(--color-text-tertiary)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
} as const;

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

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-5)" }}>
        <section aria-labelledby="payment-link-intro">
          <h2
            id="payment-link-intro"
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-title)",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Create a payment link
          </h2>
          <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-body)", lineHeight: 1.45 }}>
            Share a web link or app link that resolves to your visible receiving identity.
          </p>
        </section>

        {accountOptions.length > 1 && (
          <section aria-labelledby="receive-to-heading" style={sectionStyle}>
            <span id="receive-to-heading" style={eyebrowStyle}>Receive to</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderBottom: "1px solid var(--color-border-subtle)" }}>
              {accountOptions.map((a) => {
                const selected = to === a.identity;
                return (
                  <button
                    key={a.identity}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTo(a.identity)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "var(--space-3)",
                      alignItems: "center",
                      minHeight: 44,
                      width: "100%",
                      padding: "var(--space-3) 0",
                      background: "transparent",
                      border: 0,
                      borderTop: "1px solid var(--color-border-subtle)",
                      color: "var(--color-text-primary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
                      <span style={{ fontSize: "var(--text-body)", fontWeight: 500 }}>{a.name}</span>
                      <span style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)" }}>
                        {truncateId(a.identity, 8, 6)}
                      </span>
                    </span>
                    {selected ? (
                      <CheckCircle size={18} weight="Bold" aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                    ) : (
                      <span style={{ color: "var(--color-text-disabled)", fontSize: "var(--text-label)", fontWeight: 600 }}>Use</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="payment-details-heading" style={sectionStyle}>
          <span id="payment-details-heading" style={eyebrowStyle}>Optional details</span>
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
        </section>

        {links ? (
          <>
            <section aria-labelledby="link-type-heading" style={sectionStyle}>
              <span id="link-type-heading" style={eyebrowStyle}>Link type</span>
              <div role="tablist" aria-label="QR link type" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--color-border-default)" }}>
                {(["web", "deep"] as const).map((mode) => {
                  const selected = qrMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setQrMode(mode)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-2)",
                        minHeight: 44,
                        padding: "0 var(--space-3)",
                        background: "transparent",
                        border: 0,
                        borderBottom: selected ? "1px solid var(--color-text-primary)" : "1px solid transparent",
                        color: selected ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--text-label)",
                        fontWeight: 600,
                      }}
                    >
                      {mode === "web" ? <LinkRound size={14} /> : <QrCode size={14} />}
                      {mode === "web" ? "Web link" : "App link"}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="qr-preview-heading" style={{ ...sectionStyle, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
              <span id="qr-preview-heading" style={{ ...eyebrowStyle, alignSelf: "stretch", marginBottom: 0 }}>QR and link preview</span>
              <div style={{ padding: "var(--space-3)", background: QR_BG, borderRadius: "var(--radius-card)" }} aria-label={`${qrMode === "web" ? "Web" : "App"} payment link QR code`}>
                <QRCodeSVG
                  value={qrMode === "web" ? links.web : links.deep}
                  size={200}
                  bgColor={QR_BG}
                  fgColor={QR_FG}
                  level="M"
                />
              </div>
              <span style={{ alignSelf: "stretch", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", lineHeight: 1.45, textAlign: "center", wordBreak: "break-all" }}>
                {qrMode === "web" ? links.web : links.deep}
              </span>
            </section>

            <section aria-labelledby="copy-actions-heading" style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <span id="copy-actions-heading" className="sr-only">Copy actions</span>
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
            </section>

            <section aria-labelledby="receive-identity-heading" style={sectionStyle}>
              <span id="receive-identity-heading" style={eyebrowStyle}>Receiving identity</span>
              <p style={{ margin: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", lineHeight: 1.5, wordBreak: "break-all" }}>
                {to.trim().toUpperCase()}
              </p>
            </section>
          </>
        ) : (
          <section aria-labelledby="payment-link-empty-heading" style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
            <span id="payment-link-empty-heading" style={eyebrowStyle}>Link unavailable</span>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
              <LinkRound size={18} style={{ flex: "0 0 auto", marginTop: 2, color: "var(--color-text-tertiary)" }} />
              <div>
                <p style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "var(--text-body)", lineHeight: 1.45 }}>
                  Select an account with a valid receiving identity to generate a payment link.
                </p>
                <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-tertiary)", fontSize: "var(--text-caption)", lineHeight: 1.45 }}>
                  Amount and label remain optional and only pre-fill the sender's payment.
                </p>
              </div>
            </div>
          </section>
        )}
      </motion.div>
    </AppShell>
  );
}

function CopyButton({ label, copied, onCopy }: { label: string; copied: boolean; onCopy: () => void }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      shape="sharp"
      onClick={onCopy}
      style={{ width: "100%", color: copied ? "var(--color-accent)" : undefined }}
      aria-live="polite"
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
