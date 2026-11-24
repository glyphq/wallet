import { useState } from "react";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { truncateId } from "@/lib/format";
import { RequestApprovalActions, RequestSectionTitle } from "./request-primitives";
import type { ConnectRequest, GlyphPermission } from "@/lib/request-schema";
import type { ConnectApproveResult } from "@/lib/request-approvals";
import { CheckmarkCircle01Icon } from "@/lib/icons";
import { DappPolicyControls } from "@/components/dapp-policy-controls";
import { DAPP_PERMISSION_LABELS, DEFAULT_DAPP_EXPIRY_DURATION_MS, makeDappExpiresAt, sanitizeTransferLimitQu } from "@/lib/dapp-permissions";

export type { ConnectRequest } from "@/lib/request-schema";

interface ConnectPreviewProps {
  request: ConnectRequest;
  onApprove: (result: ConnectApproveResult) => void;
  onReject: () => void;
}

export function ConnectPreview({ request, onApprove, onReject }: ConnectPreviewProps) {
  const accounts = useSessionStore((s) => s.accounts);
  const settings = usePersistedStore((s) => s.settings);
  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === s.settings.activeWalletId));

  const [selectedIndex, setSelectedIndex] = useState(settings.activeAccountIndex);

  const requestedPerms = request.permissions ?? [];
  const [grantedPerms, setGrantedPerms] = useState<Set<string>>(() => new Set(requestedPerms));
  const [transferLimitQu, setTransferLimitQu] = useState("");
  const [expiryDurationMs, setExpiryDurationMs] = useState<number | undefined>(DEFAULT_DAPP_EXPIRY_DURATION_MS);

  const selectedAccount = accounts[selectedIndex] ?? null;

  function togglePerm(p: string) {
    setGrantedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function approve() {
    if (!selectedAccount) return;
    const permissions = requestedPerms.filter((p) => grantedPerms.has(p)) as GlyphPermission[];
    const sanitizedLimit = sanitizeTransferLimitQu(transferLimitQu);
    onApprove({
      identity: selectedAccount.identity,
      accountIndex: selectedIndex,
      permissions,
      transferLimitQu: sanitizedLimit,
      expiryDurationMs,
      expiresAt: makeDappExpiresAt(expiryDurationMs),
    });
  }

  const grantsTransferLike = requestedPerms.some((p) => (p === "transfer" || p === "sc_call") && grantedPerms.has(p));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
      {/* Account picker */}
      <div>
        <div style={{ marginBottom: "var(--space-2)" }}><RequestSectionTitle>Account</RequestSectionTitle></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((sessionAccount, i) => {
            const account = wallet?.accounts[i];
            if (!account) return null;
            const isSelected = i === selectedIndex;
            return (
              <button
                key={account.index}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-4)",
                  padding: "var(--space-3) 0",
                  background: "none",
                  border: "none",
                  borderBottom: `1px solid ${isSelected ? "var(--color-border-strong)" : "var(--color-border-subtle)"}`,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {account.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  {isSelected ? (
                    <CheckmarkCircle01Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                  ) : null}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
                    {truncateId(sessionAccount.identity, 10, 10)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Requested permissions — user can deselect individual permissions */}
      {requestedPerms.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div>
            <div style={{ marginBottom: "var(--space-2)" }}><RequestSectionTitle>Permissions</RequestSectionTitle></div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {requestedPerms.map((p) => {
                const granted = grantedPerms.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePerm(p)}
                    style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: granted ? "var(--color-text-display)" : "var(--color-text-disabled)", letterSpacing: "0.05em", minWidth: 20 }}>
                      {granted ? "On" : "Off"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: granted ? "var(--color-text-primary)" : "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                      {DAPP_PERMISSION_LABELS[p] ?? p}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <RequestSectionTitle>Limits</RequestSectionTitle>
        <DappPolicyControls
          transferLimitQu={transferLimitQu}
          expiryDurationMs={expiryDurationMs}
          onTransferLimitChange={setTransferLimitQu}
          onExpiryDurationChange={setExpiryDurationMs}
          showLimit={grantsTransferLike}
          idPrefix="connect-dapp-policy"
        />
      </div>

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Connect"
        approveDisabled={!selectedAccount}
      />
    </div>
  );
}
