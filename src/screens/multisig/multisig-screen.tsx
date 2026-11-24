import { AsciiSkeleton } from "ascii-reveal";
import { useNavigate } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { FramedAvatar } from "@/components/framed-avatar";
import { Tag } from "@/components/tag";
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

const CARD_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  width: "100%",
  minWidth: 0,
  padding: "var(--space-3) var(--space-4)",
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-sharp)",
} as const;

const CARD_BUTTON_STYLE = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  width: "100%",
  minWidth: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
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
        <div key={index} style={CARD_STYLE}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <AsciiSkeleton as="div" variant="scan" rows={2} width={34} height={34} animate={false} seed={index + 1} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <AsciiSkeleton as="div" variant="scan" lines={1} widths={[110]} animate={false} seed={index + 11} />
              <div style={{ height: 6 }} />
              <AsciiSkeleton as="div" variant="scan" lines={1} widths={[150]} animate={false} seed={index + 21} />
            </div>
            <AsciiSkeleton as="div" variant="scan" lines={1} widths={[72]} animate={false} seed={index + 31} />
          </div>
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
  const detail = entry.detail;
  const name = entry.name.trim() || "Unnamed vault";
  const assets = detail?.assets ?? [];
  const hasPendingRelease = (detail?.proposals.length ?? 0) > 0;
  const belowHoldingFee = detail && holdingFee !== null && detail.balance < holdingFee;

  return (
    <article style={CARD_STYLE} className="corner-frame">
      {detail ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${name}`}
          style={{ ...CARD_BUTTON_STYLE, flexDirection: "column", alignItems: "stretch" }}
        >
          <span style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", width: "100%", minWidth: 0 }}>
            <FramedAvatar seed={`msvault:${entry.id}`} size={34} />
            <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
              <span style={NAME_STYLE}>{name}</span>
              <VaultId id={entry.id} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-1)", flexShrink: 0 }}>
              <span style={VALUE_STYLE}>{`${formatQu(detail.balance)} QU`}</span>
              <span style={{ ...CAPTION_STYLE, textAlign: "right" }}>
                {detail.requiredApprovals} of {detail.owners.length} approvals
              </span>
            </span>
          </span>

          {assets.length > 0 ? (
            <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", minWidth: 0 }}>
              {assets.slice(0, 3).map((balance) => (
                <Tag key={`${balance.asset.issuer}:${balance.asset.assetName.toString()}`}>
                  {balance.asset.name || "Asset"}
                </Tag>
              ))}
              {assets.length > 3 ? <Tag>{`+${assets.length - 3}`}</Tag> : null}
            </span>
          ) : null}
          {hasPendingRelease || belowHoldingFee ? (
            <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", minWidth: 0 }}>
              {hasPendingRelease ? <Tag variant="warning">Pending release</Tag> : null}
              {belowHoldingFee ? <Tag variant="warning">Below holding fee</Tag> : null}
            </span>
          ) : null}
        </button>
      ) : (
        <>
          <button type="button" onClick={onOpen} aria-label={`Open ${name}`} style={CARD_BUTTON_STYLE}>
            <FramedAvatar seed={`msvault:${entry.id}`} size={34} />
            <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
              <span style={NAME_STYLE}>{name}</span>
              <VaultId id={entry.id} />
            </span>
            <span style={VALUE_STYLE}>—</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span role="status" style={{ ...CAPTION_STYLE, color: "var(--color-status-warning)" }}>
              Could not load this vault
            </span>
            <TextButton onClick={onRetry} tone="muted">
              Retry
            </TextButton>
          </div>
        </>
      )}
    </article>
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
