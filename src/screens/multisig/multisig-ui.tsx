import type { CSSProperties, ReactNode } from "react";
import { AppShell } from "@/layouts/app-shell";
import { Alert01Icon } from "@/lib/icons";
import { useMsvaultAssetMeta } from "@/hooks/use-msvault";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { truncateId } from "@/lib/format";
import {
  formatAssetAmount,
  type MsvaultAssetRef,
} from "@/lib/msvault";
import type { SessionAccount } from "@/lib/session-account";
import type { Contact, WalletMeta } from "@/store/persisted";

const MONO_VALUE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-primary)",
  minWidth: 0,
  overflowWrap: "anywhere",
  textAlign: "right",
};

const CAPTION_COPY: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--leading-compact)",
  color: "var(--color-text-tertiary)",
  overflowWrap: "anywhere",
};

/** Fixed-footer multisig flow shell; the body scrolls independently. */
export function MultisigFlowShell({ children, footer, notch, statusBar }: { children: ReactNode; footer?: ReactNode; notch?: ReactNode; statusBar?: ReactNode }) {
  return (
    <AppShell fullBleed statusBar={statusBar} contentStyle={{ overflow: "hidden", padding: 0 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          height: "100%",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflowY: "auto",
            padding: "var(--screen-padding)",
          }}
        >
          {children}
        </div>
        {notch ? (
          <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", justifyContent: "center", pointerEvents: "auto", marginBottom: -1 }}>
            {notch}
          </div>
        ) : null}
        {footer ? (
          <div
            style={{
              flexShrink: 0,
              borderTop: "1px solid var(--color-border-subtle)",
              padding: "var(--space-3) var(--screen-padding)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

/** Resolves a display name for an identity: contact, own account, then truncated address. */
export function identityDisplayName(
  identity: string,
  contacts: Contact[],
  wallet: WalletMeta | null,
  accounts: SessionAccount[],
): string {
  const target = identity.trim().toUpperCase();
  if (!target) return identity;

  const contact = contacts.find((item) => item.identity.trim().toUpperCase() === target);
  if (contact?.name.trim()) return contact.name.trim();

  if (wallet) {
    for (const account of wallet.accounts) {
      const accountIdentity = getWalletAccountIdentity(wallet, account.index, accounts);
      if (accountIdentity?.trim().toUpperCase() === target && account.name.trim()) {
        return account.name.trim();
      }
    }
  }

  return truncateId(identity);
}

export function IdentityName({
  identity,
  contacts,
  wallet,
  sessionAccounts,
}: {
  identity: string;
  contacts: Contact[];
  wallet: WalletMeta | null;
  sessionAccounts: SessionAccount[];
}) {
  return (
    <span title={identity} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      {identityDisplayName(identity, contacts, wallet, sessionAccounts)}
    </span>
  );
}

/** Mono vault identifier. */
export function VaultId({ id }: { id: bigint }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        color: "var(--color-text-disabled)",
        letterSpacing: "0.04em",
      }}
    >
      #{id.toString()}
    </span>
  );
}

export function FeeRow({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-compact)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-tertiary)",
            flexShrink: 0,
            maxWidth: "60%",
            overflowWrap: "anywhere",
          }}
        >
          {label}
        </span>
        <span style={MONO_VALUE}>{value}</span>
      </div>
      {hint ? (
        <span
          style={{
            alignSelf: "flex-end",
            textAlign: "right",
            maxWidth: "100%",
            ...CAPTION_COPY,
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Asset name plus an optional formatted share amount, using live metadata decimals. */
export function AssetMetaLabel({ asset, amount }: { asset: MsvaultAssetRef; amount?: bigint }) {
  const { data } = useMsvaultAssetMeta(asset);
  const name = data?.name || asset.name || "Asset";
  const decimals = data?.decimals ?? 0;

  return (
    <span style={{ display: "inline-flex", gap: "var(--space-1)", minWidth: 0, overflowWrap: "anywhere" }}>
      {amount !== undefined ? (
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-text-primary)" }}>
          {formatAssetAmount(amount, decimals)}
        </span>
      ) : null}
      <span style={{ color: amount !== undefined ? "var(--color-text-secondary)" : undefined }}>{name}</span>
    </span>
  );
}


/** Small status notch attached above the fixed footer, matching shell info tabs. */
export function MultisigNotch({ children }: { children: string }) {
  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "4px 10px",
        background: "var(--color-bg-nav)",
        borderRadius: "var(--radius-sharp) var(--radius-sharp) 0 0",
        color: "var(--color-status-warning)",
      }}
    >
      <Alert01Icon size={13} strokeWidth={1.5} aria-hidden="true" />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {children}
      </span>
    </div>
  );
}

/** Clickable pending-approval counter styled like shell info notches. */
export function PendingApprovalsNotch({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${count} pending approval${count === 1 ? "" : "s"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "4px 10px",
        border: "1px solid var(--color-border-subtle)",
        borderBottom: 0,
        background: "var(--color-bg-base)",
        borderRadius: "var(--radius-sharp) var(--radius-sharp) 0 0",
        color: "var(--color-accent)",
        cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Pending
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", fontVariantNumeric: "tabular-nums", color: "var(--color-accent)" }}>
        {count}
      </span>
    </button>
  );
}
