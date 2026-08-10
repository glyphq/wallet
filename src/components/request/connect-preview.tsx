import { useState } from "react";
import { Button } from "@/components/button";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { truncateId } from "@/lib/format";
import { RequestActionBar, RequestSectionTitle } from "./request-primitives";
import type { ConnectRequest, GlyphPermission } from "@/lib/request-schema";
import { CheckCircle } from "@solar-icons/react";
import { DappPolicyControls } from "@/components/dapp-policy-controls";
import { DEFAULT_DAPP_EXPIRY_DURATION_MS, makeDappExpiresAt, sanitizeTransferLimitQu } from "@/lib/dapp-permissions";

export type { ConnectRequest } from "@/lib/request-schema";

export interface ConnectApproveResult {
  identity: string;
  permissions: GlyphPermission[];
  transferLimitQu?: string;
  expiryDurationMs?: number;
  expiresAt?: number;
}

interface ConnectPreviewProps {
  request: ConnectRequest;
  onApprove: (result: ConnectApproveResult) => void;
  onReject: () => void;
}

const PERMISSION_LABELS: Record<string, string> = {
  transfer: "Transfer QU",
  sc_call: "Contract calls",
  sign_message: "Sign messages",
};

export function ConnectPreview({ request, onApprove, onReject }: ConnectPreviewProps) {
  const wallets = useSessionStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));

  const [selectedIndex, setSelectedIndex] = useState(settings.activeAccountIndex);

  const requestedPerms = request.permissions ?? [];
  const [grantedPerms, setGrantedPerms] = useState<Set<string>>(() => new Set(requestedPerms));
  const [transferLimitQu, setTransferLimitQu] = useState("");
  const [expiryDurationMs, setExpiryDurationMs] = useState<number | undefined>(DEFAULT_DAPP_EXPIRY_DURATION_MS);

  const selectedWallet = wallets[selectedIndex] ?? null;

  function togglePerm(p: string) {
    setGrantedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function approve() {
    if (!selectedWallet) return;
    const permissions = requestedPerms.filter((p) => grantedPerms.has(p)) as GlyphPermission[];
    const sanitizedLimit = sanitizeTransferLimitQu(transferLimitQu);
    onApprove({
      identity: selectedWallet.identity,
      permissions,
      transferLimitQu: sanitizedLimit,
      expiryDurationMs,
      expiresAt: makeDappExpiresAt(expiryDurationMs),
    });
  }

  const grantsTransferLike = requestedPerms.some((p) => (p === "transfer" || p === "sc_call") && grantedPerms.has(p));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
	      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)" }}>
	        Connect this app to your Vault.
	      </div>

	      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
	        Manage this connection in Settings at any time.
      </div>

      {/* Account picker */}
      <div>
	          <div style={{ marginBottom: "var(--space-2)" }}><RequestSectionTitle>Account</RequestSectionTitle></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {wallets.map((w, i) => {
            const account = vault?.accounts[i];
            if (!account) return null;
            const isSelected = i === selectedIndex;
            return (
              <button
                key={i}
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
                    <CheckCircle size={16} weight="Outline" aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                  ) : null}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
                    {truncateId(w.identity, 10, 10)}
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
                      {PERMISSION_LABELS[p] ?? p}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
	          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
		            Each action still asks for your approval.
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
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
          Limits apply to this dApp and selected account only.
        </div>
      </div>

      <RequestActionBar>
        <Button variant="secondary" onClick={onReject} style={{ flex: 1 }}>
          Reject
        </Button>
        <Button onClick={approve} disabled={!selectedWallet} style={{ flex: 1 }}>
          Connect
        </Button>
      </RequestActionBar>
    </div>
  );
}
