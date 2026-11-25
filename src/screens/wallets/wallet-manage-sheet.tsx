import { Button } from "@/components/button";
import { Identicon } from "@/components/identicon";
import { Sheet } from "@/components/sheet";
import { getAccountIdentity } from "@/lib/accounts";
import { formatQu } from "@/lib/format";
import {
  PencilEdit01Icon, File02Icon, Key01Icon, ViewOffIcon, ViewIcon, Delete02Icon,
  CheckmarkCircle01Icon,
} from "@/lib/icons";
import type { SessionAccount } from "@/lib/session-account";
import type { AccountMeta } from "@/store/persisted";
import { ActionRow, ActionSection } from "./wallet-detail-parts";

interface ManageAccountSheetProps {
  account: AccountMeta | null;
  onClose: () => void;
  isActive: boolean;
  activeAccountIndex: number;
  sessionWallets: SessionAccount[];
  balances: Record<string, bigint> | undefined;
  hideBalances: boolean;
  onMakeActive: (account: AccountMeta) => void;
  onRename: (account: AccountMeta) => void;
  onEditMeta: (account: AccountMeta) => void;
  onVerifyBackup: () => void;
  onRevealSeed: (account: AccountMeta) => void;
  onToggleHide: (account: AccountMeta) => void;
  onRemove: (account: AccountMeta) => void;
}

/** Bottom sheet with every action available for a single wallet account. */
export function ManageAccountSheet({
  account,
  onClose,
  isActive,
  activeAccountIndex,
  sessionWallets,
  balances,
  hideBalances,
  onMakeActive,
  onRename,
  onEditMeta,
  onVerifyBackup,
  onRevealSeed,
  onToggleHide,
  onRemove,
}: ManageAccountSheetProps) {
  return (
    <Sheet
      open={!!account}
      onClose={onClose}
      title={account ? `Manage ${account.name}` : "Manage account"}
      footer={
        <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={onClose}>
          Close
        </Button>
      }
    >
      {account && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              paddingBottom: "var(--space-4)",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            <Identicon kind="account" code={`A${account.index + 1}`} seed={getAccountIdentity(account, sessionWallets[account.index] ?? null) ?? account.name} label={account.name} size={40} radius={8} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                {account.name}
              </div>
              {account.hidden || (isActive && activeAccountIndex === account.index) ? (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                  {isActive && activeAccountIndex === account.index ? "ACTIVE" : ""}
                  {isActive && activeAccountIndex === account.index && account.hidden ? " · " : ""}
                  {account.hidden ? "HIDDEN" : ""}
                </div>
              ) : null}
            </div>
            {balances && (() => {
              const id = getAccountIdentity(account, sessionWallets[account.index] ?? null);
              const bal = id ? balances[id] ?? null : null;
              return bal !== null ? (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-display)", flexShrink: 0 }}>
                  {hideBalances ? "••••••" : `${formatQu(bal)} QU`}
                </span>
              ) : null;
            })()}
          </div>

          <ActionSection title="Selection">
            <ActionRow
              title={isActive && activeAccountIndex === account.index ? "Active account" : "Use this account"}
              description={account.hidden ? "Hidden accounts cannot be made active." : "Use for sending, receiving, and signing."}
              icon={CheckmarkCircle01Icon}
              selected={isActive && activeAccountIndex === account.index}
              disabled={!isActive || account.hidden || activeAccountIndex === account.index}
              onClick={() => onMakeActive(account)}
            />
          </ActionSection>

          <ActionSection title="Details">
            <ActionRow
              title="Rename"
              description="Change the label shown in the wallet and switcher."
              icon={PencilEdit01Icon}
              onClick={() => onRename(account)}
            />
            <ActionRow
              title="Notes and tags"
              description="Keep metadata such as staking, cold, or treasury."
              icon={File02Icon}
              onClick={() => onEditMeta(account)}
            />
          </ActionSection>

          <ActionSection title="Security">
            <ActionRow
              title="Verify backup"
              description="Check your saved seed against this wallet. Hidden by default."
              icon={CheckmarkCircle01Icon}
              onClick={onVerifyBackup}
            />
            <ActionRow
              title="Reveal seed"
              description="Decrypt and display this account seed for a limited time."
              icon={Key01Icon}
              onClick={() => onRevealSeed(account)}
            />
          </ActionSection>

          <ActionSection title="Visibility">
            <ActionRow
              title={account.hidden ? "Unhide account" : "Hide account"}
              description={account.hidden ? "Show this account in the switcher again." : "Remove from the switcher without deleting it."}
              icon={account.hidden ? ViewIcon : ViewOffIcon}
              onClick={() => onToggleHide(account)}
            />
          </ActionSection>

          <ActionSection title="Danger zone" danger>
            <ActionRow
              title="Remove account"
              description="Delete this account from the wallet. This cannot be undone."
              icon={Delete02Icon}
              danger
              onClick={() => onRemove(account)}
            />
          </ActionSection>
        </div>
      )}
    </Sheet>
  );
}
