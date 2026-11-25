import { useState } from "react";
import { AsciiSkeleton } from "ascii-reveal";
import { useNavigate } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { FramedAvatar } from "@/components/framed-avatar";
import { TextButton } from "@/components/text-button";
import { useMsvaultFees, useMsvaultList } from "@/hooks/use-msvault";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { extractMessage, formatQu } from "@/lib/format";
import type { MsvaultListEntry } from "@/lib/msvault";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { VaultId } from "./multisig-ui";

const PAGE_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  width: "min(100%, 640px)",
  margin: "0 auto",
  minWidth: 0,
} as const;

const INTRO_COPY = {
  margin: 0,
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body-compact)",
  lineHeight: "var(--leading-body)",
  color: "var(--color-text-secondary)",
} as const;

const NAME_STYLE = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body-compact)",
  fontWeight: 500,
  color: "var(--color-text-primary)",
  minWidth: 0,
  overflowWrap: "anywhere",
} as const;

const VALUE_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-primary)",
  textAlign: "right",
  minWidth: 0,
  overflowWrap: "anywhere",
} as const;

const CAPTION_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--leading-compact)",
  color: "var(--color-text-tertiary)",
  minWidth: 0,
  overflowWrap: "anywhere",
} as const;

function VaultListSkeleton() {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 64, padding: "var(--space-3)" }}>
          <AsciiSkeleton as="div" variant="scan" rows={2} width={34} height={34} animate={false} seed={index + 1} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <AsciiSkeleton as="div" variant="scan" lines={1} widths={[110]} animate={false} seed={index + 11} />
            <div style={{ height: 6 }} />
            <AsciiSkeleton as="div" variant="scan" lines={1} widths={[150]} animate={false} seed={index + 21} />
          </div>
          <AsciiSkeleton as="div" variant="scan" lines={1} widths={[72]} animate={false} seed={index + 31} />
        </div>
      ))}
    </div>
  );
}

function VaultCard({
  entry,
  holdingFee,
  onOpen,
  onRetry,
}: {
  entry: MsvaultListEntry;
  holdingFee: bigint | null;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const detail = entry.detail;
  const name = entry.name.trim() || "Unnamed vault";

  if (!detail) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 64, padding: "var(--space-3)", minWidth: 0 }}>
        <FramedAvatar seed={`msvault:${entry.id}`} size={34} />
        <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={NAME_STYLE}>{name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", ...CAPTION_STYLE }}>
            <VaultId id={entry.id} />
            <span style={{ color: "var(--color-status-warning)" }}>Could not load</span>
          </span>
        </span>
        <TextButton onClick={onRetry} tone="muted">Retry</TextButton>
      </div>
    );
  }

  const hasPendingRelease = detail.proposals.length > 0;
  const belowHoldingFee = holdingFee !== null && detail.balance < holdingFee;
  const status = [
    hasPendingRelease ? "Pending release" : null,
    belowHoldingFee ? "Below holding fee" : null,
  ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Open ${name}`}
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
      <FramedAvatar seed={`msvault:${entry.id}`} size={34} />
      <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ ...NAME_STYLE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", ...CAPTION_STYLE }}>
          <VaultId id={entry.id} />
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
        <span style={VALUE_STYLE}>{`${formatQu(detail.balance)} QU`}</span>
        {status ? <span style={{ ...CAPTION_STYLE, textAlign: "right", color: "var(--color-status-warning)" }}>{status}</span> : null}
      </span>
    </button>
  );
}

export default function MultisigScreen() {
  const navigate = useNavigate();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const accounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const activeIndex = settings.activeAccountIndex;
  const identity = getWalletAccountIdentity(wallet, activeIndex, accounts);

  const listQuery = useMsvaultList(identity);
  const feesQuery = useMsvaultFees();
  const entries = listQuery.data ?? [];
  const holdingFee = feesQuery.data?.holdingFee ?? null;
  const listError = listQuery.isError ? extractMessage(listQuery.error, "Could not load multisig vaults.") : "";

  function createVault() {
    navigate("/multisig/new");
  }

  return (
    <AppShell>
      <div style={PAGE_STYLE}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={INTRO_COPY}>Shared vaults release funds only after the required owners approve.</p>
          <Button size="md" onClick={createVault} style={{ width: "100%" }}>
            New multisig
          </Button>
        </div>

        {listQuery.isLoading ? (
          <VaultListSkeleton />
        ) : listError ? (
          <div
            role="alert"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              padding: "var(--space-3)",
              border: "1px solid var(--color-status-error)",
              borderRadius: "var(--radius-sharp)",
              background: "var(--color-status-error-soft)",
            }}
          >
            <span style={{ ...INTRO_COPY, color: "var(--color-status-error)", overflowWrap: "anywhere" }}>{listError}</span>
            <TextButton onClick={() => void listQuery.refetch()} tone="danger">
              Retry
            </TextButton>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
            <EmptyCollectionState
              icon="apps"
              title="No multisig vaults"
              description="Create a shared vault for funds that need multiple approvals."
            />
          </div>
        ) : (
          <section aria-label="Multisig vaults" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
            {entries.map((entry) => (
              <VaultCard
                key={entry.id.toString()}
                entry={entry}
                holdingFee={holdingFee}
                onOpen={() => navigate(`/multisig/${entry.id}`)}
                onRetry={() => void listQuery.refetch()}
              />
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
