import { useMemo, useState, type CSSProperties } from "react";
import { AsciiSkeleton } from "ascii-reveal";
import { useNavigate, useParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { FramedAvatar } from "@/components/framed-avatar";
import { ScreenHeader } from "@/components/screen-header";
import { useMsvaultDetail } from "@/hooks/use-msvault";
import { MsvaultInactiveError } from "@/lib/api/msvault";
import { extractMessage, formatQu, truncateId } from "@/lib/format";
import type { MsvaultProposal } from "@/lib/msvault";
import { AssetMetaLabel, VaultId } from "./multisig-ui";

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

function ApprovalRow({
  proposal,
  onOpen,
}: {
  proposal: MsvaultProposal;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Review release to ${proposal.destination}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: 64,
        padding: "var(--space-3)",
        border: 0,
        borderRadius: "var(--radius-sharp)",
        background: hovered ? "var(--color-bg-elevated)" : "transparent",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        minWidth: 0,
      }}
    >
      <FramedAvatar seed={proposal.destination} size={34} />
      <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {proposal.kind === "asset" && proposal.asset ? (
            <AssetMetaLabel asset={proposal.asset} amount={proposal.amount} />
          ) : (
            `${formatQu(proposal.amount)} QU`
          )}
        </span>
        <span title={proposal.destination} style={{ ...MONO_META, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {truncateId(proposal.destination, 8, 8)}
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {proposal.approvals} of {proposal.requiredApprovals}
        </span>
      </span>
    </button>
  );
}

export default function MultisigApprovalsScreen() {
  const navigate = useNavigate();
  const params = useParams();

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
        <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 64, padding: "var(--space-3)" }}>
              <AsciiSkeleton as="div" variant="scan" rows={2} width={34} height={34} animate={false} seed={row + 1} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <AsciiSkeleton as="div" variant="scan" lines={1} widths={[130]} animate={false} seed={row + 11} />
                <div style={{ height: 6 }} />
                <AsciiSkeleton as="div" variant="scan" lines={1} widths={[180]} animate={false} seed={row + 21} />
              </div>
              <AsciiSkeleton as="div" variant="scan" lines={1} widths={[60]} animate={false} seed={row + 31} />
            </div>
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
          <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>{extractMessage(detailQuery.error, "Could not load vault")}</p>
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
            <ApprovalRow
              key={proposal.key}
              proposal={proposal}
              onOpen={() => navigate(approvalHref(proposal))}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
