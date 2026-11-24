import { useMemo, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { FramedAvatar } from "@/components/framed-avatar";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { useMsvaultDetail } from "@/hooks/use-msvault";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { MsvaultInactiveError } from "@/lib/api/msvault";
import { extractMessage, formatQu, truncateId } from "@/lib/format";
import type { MsvaultProposal } from "@/lib/msvault";
import { AssetMetaLabel, VaultId, identityDisplayName } from "./multisig-ui";

const SECTION_LABEL: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-tertiary)",
};

const BODY_COPY: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--leading-body)",
  color: "var(--color-text-secondary)",
  overflowWrap: "anywhere",
};

const MONO_META: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  color: "var(--color-text-tertiary)",
  overflowWrap: "anywhere",
};

const CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  width: "100%",
  padding: "var(--space-4)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-sharp)",
  background: "var(--color-bg-surface)",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

function ApprovalCard({
  proposal,
  owners,
  contacts,
  wallet,
  sessionAccounts,
  onOpen,
}: {
  proposal: MsvaultProposal;
  owners: string[];
  contacts: Parameters<typeof identityDisplayName>[1];
  wallet: Parameters<typeof identityDisplayName>[2];
  sessionAccounts: Parameters<typeof identityDisplayName>[3];
  onOpen: () => void;
}) {
  const remaining = Math.max(0, proposal.requiredApprovals - proposal.approvals);
  const ready = remaining === 0;
  const destinationName = identityDisplayName(proposal.destination, contacts, wallet, sessionAccounts);

  return (
    <button type="button" className="corner-frame" onClick={onOpen} style={CARD}>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span style={MONO_META}>{proposal.kind === "qubic" ? "QUBIC release" : "Asset release"}</span>
        <Tag variant={ready ? "success" : "warning"}>{ready ? "Ready" : `Needs ${remaining} more`}</Tag>
      </span>

      <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap", minWidth: 0 }}>
        {proposal.kind === "asset" && proposal.asset ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
            <AssetMetaLabel asset={proposal.asset} amount={proposal.amount} />
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {formatQu(proposal.amount)} QU
          </span>
        )}
      </span>

      <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
        <span style={SECTION_LABEL}>To</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap", minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
            {destinationName}
          </span>
          <span style={{ ...MONO_META, color: "var(--color-text-disabled)" }}>{truncateId(proposal.destination, 8, 8)}</span>
        </span>
      </span>

      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span style={MONO_META}>{proposal.approvals} of {proposal.requiredApprovals} approvals</span>
        <span aria-hidden="true" style={{ ...MONO_META, color: "var(--color-text-disabled)" }}>·</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
          {proposal.supporters.map((ownerIdx) => {
            const supporter = owners[ownerIdx];
            if (!supporter) return null;
            return (
              <span key={`${proposal.key}:${ownerIdx}`} title={identityDisplayName(supporter, contacts, wallet, sessionAccounts)}>
                <FramedAvatar seed={supporter} size={22} />
              </span>
            );
          })}
        </span>
      </span>

      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-accent)", letterSpacing: "0.04em" }}>
        Review request →
      </span>
    </button>
  );
}

export default function MultisigApprovalsScreen() {
  const navigate = useNavigate();
  const params = useParams();

  const settings = usePersistedStore((s) => s.settings);
  const wallets = usePersistedStore((s) => s.wallets);
  const contacts = usePersistedStore((s) => s.contacts);
  const sessionAccounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const rawId = params.id ?? "";
  const vaultId = useMemo(() => {
    if (!/^\d+$/.test(rawId)) return null;
    try { return BigInt(rawId); } catch { return null; }
  }, [rawId]);

  const detailQuery = useMsvaultDetail(vaultId);
  const detail = detailQuery.data ?? null;

  const header = (
    <ScreenHeader
      title="Pending approvals"
      onBack={() => navigate(`/multisig/${rawId}`)}
      backAriaLabel="Back to vault"
    />
  );

  function approvalHref(proposal: MsvaultProposal): string {
    const search = new URLSearchParams({
      kind: proposal.kind,
      amount: proposal.amount.toString(),
      to: proposal.destination,
    });
    if (proposal.kind === "asset" && proposal.asset) {
      search.set("asset", `${proposal.asset.issuer}:${proposal.asset.assetName.toString()}`);
    }
    return `/multisig/${rawId}/approval?${search.toString()}`;
  }

  if (!vaultId) {
    return (
      <AppShell statusBar={header}>
        <EmptyCollectionState title="Vault not found" description="This multisig vault could not be found." icon="search" />
      </AppShell>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <AppShell statusBar={header}>
        <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ height: 72, borderRadius: "var(--radius-sharp)", background: "var(--color-skeleton)" }} />
          ))}
        </div>
      </AppShell>
    );
  }

  if (detailQuery.error instanceof MsvaultInactiveError) {
    return (
      <AppShell statusBar={header}>
        <EmptyCollectionState title="This vault is inactive" description="Unpaid holding fees can close a vault." icon="activity" />
      </AppShell>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <AppShell statusBar={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>{extractMessage(detailQuery.error, "Could not load this vault.")}</p>
          <Button size="sm" variant="secondary" onClick={() => void detailQuery.refetch()}>Retry</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      statusBar={header}
      contentStyle={{ padding: "var(--space-4)", paddingBottom: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      {detail.proposals.length === 0 ? (
        <EmptyCollectionState title="No pending approvals" description="Releases requested by owners appear here." icon="activity" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-2)" }}>
            <h2 style={SECTION_LABEL}>Requests</h2>
            <VaultId id={detail.id} />
          </div>
          {detail.proposals.map((proposal) => (
            <ApprovalCard
              key={proposal.key}
              proposal={proposal}
              owners={detail.owners}
              contacts={contacts}
              wallet={wallet}
              sessionAccounts={sessionAccounts}
              onOpen={() => navigate(approvalHref(proposal))}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
