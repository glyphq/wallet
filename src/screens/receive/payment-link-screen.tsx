import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { copyToClipboard } from "@/lib/clipboard";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Input } from "@/components/input";
import { Divider } from "@/components/divider";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { truncateId } from "@/lib/format";

const WEB_BASE = "https://wallet.glyphq.org/pay";

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
  const navigate = useNavigate();
  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const wallets = useSessionStore((s) => s.wallets);

  const defaultIdentity = getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets) ?? "";

  const [to, setTo] = useState(defaultIdentity);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [copiedDeep, setCopiedDeep] = useState(false);
  const [qrMode, setQrMode] = useState<"web" | "deep">("web");

  const links = useMemo(() => {
    if (!to.trim() || to.trim().length !== 60) return null;
    try { return buildLinks(to.trim().toUpperCase(), amount, label); } catch { return null; }
  }, [to, amount, label]);

  async function copy(text: string, which: "web" | "deep") {
    await copyToClipboard(text);
    if (which === "web") { setCopiedWeb(true); setTimeout(() => setCopiedWeb(false), 1500); }
    else { setCopiedDeep(true); setTimeout(() => setCopiedDeep(false), 1500); }
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
    <AppShell
      statusBar={<ScreenHeader title="Payment link" onBack={() => navigate("/receive")} />}
      contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
    >
      {/* ── Form ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Request details
        </div>

        {/* Account selector when multiple accounts exist */}
        {accountOptions.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>RECEIVE TO</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {accountOptions.map((a) => (
                <button
                  key={a.identity}
                  type="button"
                  onClick={() => setTo(a.identity)}
                  style={{
                    background: "none",
                    border: `1px solid ${to === a.identity ? "var(--color-accent)" : "var(--color-border-strong)"}`,
                    borderRadius: "var(--radius-sharp)",
                    cursor: "pointer",
                    padding: "var(--space-1) var(--space-3)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-mono-sm)",
                    color: to === a.identity ? "var(--color-accent)" : "var(--color-text-secondary)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input
          label="Amount (QU, optional)"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="Leave blank to let sender choose"
          inputMode="numeric"
        />
        <Input
          label="Label / note (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 100))}
          placeholder="e.g. Coffee, Invoice #42"
          style={{ fontFamily: "var(--font-sans)" }}
        />
      </div>

      {!links && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", textAlign: "center", padding: "var(--space-6) 0" }}>
          [SELECT AN ACCOUNT TO GENERATE A LINK]
        </div>
      )}

      {links && (
        <>
          <Divider />

          {/* ── QR code ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {(["web", "deep"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setQrMode(mode)}
                  style={{
                    background: "none",
                    border: `1px solid ${qrMode === mode ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
                    borderRadius: "var(--radius-sharp)",
                    cursor: "pointer",
                    padding: "var(--space-1) var(--space-3)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-label)",
                    color: qrMode === mode ? "var(--color-text-primary)" : "var(--color-text-disabled)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {mode === "web" ? "WEB LINK" : "GLYPH://"}
                </button>
              ))}
            </div>
            <div style={{ padding: 8, background: "#fff", borderRadius: 4 }}>
              <QRCodeSVG
                value={qrMode === "web" ? links.web : links.deep}
                size={180}
                bgColor="#FFFFFF"
                fgColor="#111111"
                level="M"
              />
            </div>
          </div>

          <Divider />

          {/* ── Link outputs ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Share links
            </div>

            <LinkRow
              label="Web link"
              sublabel="Share on Discord, embed on web — shows a preview page"
              value={links.web}
              copied={copiedWeb}
              onCopy={() => copy(links.web, "web")}
            />

            <LinkRow
              label="Direct link"
              sublabel="Opens Glyph directly — best for Glyph-to-Glyph sharing"
              value={links.deep}
              copied={copiedDeep}
              onCopy={() => copy(links.deep, "deep")}
            />

            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              Receiving identity: {truncateId(to, 8, 6)}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function LinkRow({ label, sublabel, value, copied, onCopy }: {
  label: string;
  sublabel: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: copied ? "var(--color-status-success)" : "var(--color-accent)", letterSpacing: "0.05em", padding: 0, flexShrink: 0 }}
        >
          {copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.04em", wordBreak: "break-all", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)" }}>
        {value}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
        {sublabel}
      </div>
    </div>
  );
}
