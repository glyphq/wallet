import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { FramedAvatar } from "@/components/framed-avatar";
import { Download01Icon } from "@/lib/icons";
import { recordAuditEvent } from "@/lib/audit-log";
import { getAccountIdentity } from "@/lib/accounts";
import { extractMessage, truncateId } from "@/lib/format";
import { createSignedExportEnvelope } from "@/lib/export-format";
import { saveFileDialog } from "@/lib/save-file";
import { exportWallet } from "@/lib/wallet";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const SUMMARY_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  width: "100%",
} as const;

const CAPTION_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-tertiary)",
} as const;

const ROW_STYLE = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  minWidth: 0,
} as const;

const VALUE_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  color: "var(--color-text-primary)",
  textAlign: "right",
  overflowWrap: "anywhere",
} as const;

export default function AccountExportScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const contacts = usePersistedStore((s) => s.contacts);
  const txMemos = usePersistedStore((s) => s.txMemos);
  const sessionAccounts = useSessionStore((s) => s.accounts);

  const walletId = searchParams.get("wallet");
  const wallet = wallets.find((item) => item.id === walletId)
    ?? wallets.find((item) => item.id === settings.activeWalletId)
    ?? wallets[0]
    ?? null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!wallet) return null;

  async function downloadBackup() {
    if (!wallet?.encryptedData || saving) return;
    setSaving(true);
    setError("");
    try {
      const envelope = await createSignedExportEnvelope("wallet", {
        glyph: 1,
        name: wallet.name,
        color: wallet.color,
        accounts: wallet.accounts,
        contacts,
        memos: txMemos,
        exported_at: Date.now(),
        wallet: JSON.parse(exportWallet(wallet.encryptedData)),
      });
      const defaultName = `glyph-${wallet.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wallet"}.json`;
      const saved = await saveFileDialog(defaultName, JSON.stringify(envelope, null, 2));
      if (!saved) return;
      recordAuditEvent({
        kind: "wallet_exported",
        status: "success",
        title: "Wallet exported",
        detail: `${wallet.name} exported with ${contacts.length} contacts and ${Object.keys(txMemos).length} memos`,
        walletId: wallet.id,
      });
      navigate(`/accounts?wallet=${wallet.id}`, { replace: true });
    } catch (cause) {
      setError(extractMessage(cause, "Could not export this wallet."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      fullBleed
      contentStyle={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <section style={SUMMARY_STYLE} aria-labelledby="export-summary-heading">
          <span id="export-summary-heading" style={CAPTION_STYLE}>Backup contents</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={ROW_STYLE}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Wallet</span>
              <span style={VALUE_STYLE}>{wallet.name}</span>
            </div>
            <div style={ROW_STYLE}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Accounts</span>
              <span style={VALUE_STYLE}>{wallet.accounts.length}</span>
            </div>
            <div style={ROW_STYLE}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Contacts</span>
              <span style={VALUE_STYLE}>{contacts.length}</span>
            </div>
            <div style={ROW_STYLE}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Memos</span>
              <span style={VALUE_STYLE}>{Object.keys(txMemos).length}</span>
            </div>
            <div style={ROW_STYLE}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Format</span>
              <span style={VALUE_STYLE}>Signed export v2</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {wallet.accounts.map((account) => {
              const identity = getAccountIdentity(account, sessionAccounts[account.index] ?? null);
              return (
                <div
                  key={account.index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    minHeight: 52,
                    padding: "var(--space-2) 0",
                  }}
                >
                  <FramedAvatar seed={identity ?? account.name} size={30} />
                  <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {account.name}
                    </span>
                    {identity ? (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.04em" }}>
                        {truncateId(identity, 8, 8)}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
            Balances and transaction history stay on-chain and are not included in this file.
          </span>
        </section>

        {error ? (
          <span role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>
            {error}
          </span>
        ) : null}
      </div>

      <footer style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--space-4) var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%", maxWidth: 720, margin: "0 auto" }}>
          <Button size="md" style={{ width: "100%" }} loading={saving} disabled={!wallet.encryptedData} onClick={() => void downloadBackup()}>
            <Download01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            Download backup file
          </Button>
          <Button variant="ghost" size="md" style={{ width: "100%" }} disabled={saving} onClick={() => navigate(`/accounts?wallet=${wallet.id}`, { replace: true })}>
            Cancel
          </Button>
        </div>
      </footer>
    </AppShell>
  );
}
