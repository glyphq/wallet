import type { CSSProperties, ReactNode } from "react";
import { AppShell } from "@/layouts/app-shell";
import { DropdownSelect } from "@/components/dropdown-select";
import { FramedAvatar } from "@/components/framed-avatar";
import { Tag } from "@/components/tag";
import { useMsvaultAssetMeta } from "@/hooks/use-msvault";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { truncateId } from "@/lib/format";
import {
  MSVAULT_REVOKE_FEE,
  formatAssetAmount,
  type MsvaultAssetRef,
  type MsvaultFees,
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
export function MultisigFlowShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <AppShell fullBleed contentStyle={{ overflow: "hidden", padding: 0 }}>
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

/** Compact account switcher shared by the multisig screens. */
export function MultisigAccountSelect({
  wallet,
  accounts,
  activeIndex,
  onSelect,
}: {
  wallet: WalletMeta | null;
  accounts: SessionAccount[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const visibleAccounts = wallet?.accounts.filter((account) => !account.hidden).sort((a, b) => a.index - b.index) ?? [];
  if (visibleAccounts.length <= 1) return null;

  return (
    <DropdownSelect
      id="multisig-account"
      label="Account"
      value={String(activeIndex)}
      options={visibleAccounts.map((account) => {
        const identity = getWalletAccountIdentity(wallet, account.index, accounts);
        return {
          value: String(account.index),
          label: account.name,
          icon: <FramedAvatar seed={identity ?? account.name} size={28} />,
        };
      })}
      onChange={(value) => onSelect(Number(value))}
    />
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

/** Warns when the vault cannot cover holding or revoke fees. Renders nothing when safe. */
export function HoldingFeeWarning({
  fees,
  balance,
  hasAssets,
  releaseAmount,
}: {
  fees: MsvaultFees;
  balance: bigint;
  hasAssets?: boolean;
  releaseAmount?: bigint;
}) {
  const releaseShortfall =
    releaseAmount !== undefined &&
    balance - releaseAmount < fees.holdingFee + (hasAssets ? MSVAULT_REVOKE_FEE : 0n);

  const message =
    balance < fees.holdingFee
      ? "Below the holding fee. This vault can close at the next epoch."
      : releaseShortfall
        ? "This release leaves too little QUBIC for holding and asset-transfer fees."
        : null;

  if (!message) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        border: "1px solid var(--color-status-warning)",
        borderRadius: "var(--radius-sharp)",
        background: "var(--color-status-warning-soft)",
      }}
    >
      <Tag variant="warning">Holding fee</Tag>
      <span
        style={{
          flex: "1 1 160px",
          minWidth: 0,
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-caption)",
          lineHeight: "var(--leading-body)",
          color: "var(--color-status-warning)",
          overflowWrap: "anywhere",
        }}
      >
        {message}
      </span>
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
