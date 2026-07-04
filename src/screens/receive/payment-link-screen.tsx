import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { AltArrowLeft, CheckCircle } from "@solar-icons/react";
import { copyToClipboard } from "@/lib/clipboard";
import { AppShell } from "@/layouts/app-shell";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { truncateId } from "@/lib/format";

const WEB_BASE = "https://wallet.glyphq.org/pay";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};

const stepMotion = {
  initial: { y: 4 },
  animate: { y: 0 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

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

  // ── Header ──────────────────────────────────────────────────────────────────

  const header = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "0 var(--space-4)",
      }}
    >
      <button
        type="button"
        onClick={() => navigate("/receive")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-secondary)",
          padding: "8px 0",
          display: "flex",
          alignItems: "center",
        }}
      >
        <AltArrowLeft size={20} />
      </button>
      <span
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-sans)",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--color-text-display)",
          whiteSpace: "nowrap",
        }}
      >
        Payment link
      </span>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell
      statusBar={header}
      fullBleed
      contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}
    >
      <motion.div
        {...stepMotion}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-3)" }}
      >
        {/* ── Form card ── */}
        <div
          style={{
            background: "var(--color-bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          {/* Account selector when multiple accounts exist */}
          {accountOptions.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <span style={labelStyle}>Receive to</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {accountOptions.map((a) => (
                  <button
                    key={a.identity}
                    type="button"
                    onClick={() => setTo(a.identity)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color:
                        to === a.identity
                          ? "var(--color-accent)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={labelStyle}>Amount (QU, optional)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="Leave blank to let sender choose"
              inputMode="numeric"
              autoComplete="off"
              style={{
                background: "none",
                border: "none",
                outline: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
                color: "var(--color-text-display)",
                padding: 0,
                minWidth: 0,
              }}
            />
          </div>

          {/* Label / note input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={labelStyle}>Label / note (optional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 100))}
              placeholder="e.g. Coffee, Invoice #42"
              autoComplete="off"
              style={{
                background: "none",
                border: "none",
                outline: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
                color: "var(--color-text-display)",
                padding: 0,
                minWidth: 0,
              }}
            />
          </div>
        </div>

        {/* ── No account state ── */}
        {!links && (
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.8125rem",
              color: "var(--color-text-disabled)",
              textAlign: "center",
              padding: "var(--space-6) 0",
            }}
          >
            Select an account to generate a link
          </div>
        )}

        {/* ── QR code section ── */}
        {links && (
          <div
            style={{
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-card)",
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {(["web", "deep"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setQrMode(mode)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color:
                      qrMode === mode
                        ? "var(--color-text-primary)"
                        : "var(--color-text-disabled)",
                  }}
                >
                  {mode === "web" ? "Web link" : "Glyph://"}
                </button>
              ))}
            </div>
            <div
              style={{
                padding: 16,
                background: "#fff",
                borderRadius: "var(--radius-card)",
              }}
            >
              <QRCodeSVG
                value={qrMode === "web" ? links.web : links.deep}
                size={180}
                bgColor="#FFFFFF"
                fgColor="#111111"
                level="M"
              />
            </div>
          </div>
        )}

        {/* ── Link outputs ── */}
        {links && (
          <>
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

            {/* ── Receiving identity ── */}
            <div
              style={{
                background: "var(--color-bg-surface)",
                borderRadius: "var(--radius-card)",
                padding: "14px 16px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8125rem",
                  color: "var(--color-text-disabled)",
                }}
              >
                Receiving identity: {truncateId(to, 8, 6)}
              </span>
            </div>
          </>
        )}
      </motion.div>
    </AppShell>
  );
}

// ── LinkRow ──────────────────────────────────────────────────────────────────

function LinkRow({
  label,
  sublabel,
  value,
  copied,
  onCopy,
}: {
  label: string;
  sublabel: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={labelStyle}>{label}</span>
        <button
          type="button"
          onClick={onCopy}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: copied
              ? "var(--color-accent)"
              : "var(--color-accent)",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {copied ? (
            <>
              <CheckCircle size={14} style={{ color: "var(--color-accent)" }} />
              Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.8125rem",
          color: "var(--color-text-disabled)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.75rem",
          color: "var(--color-text-disabled)",
        }}
      >
        {sublabel}
      </div>
    </div>
  );
}
