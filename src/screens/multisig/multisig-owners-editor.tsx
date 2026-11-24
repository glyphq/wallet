import type { ReactNode } from "react";
import { truncateId } from "@/lib/format";
import { Delete02Icon } from "@/lib/icons";
import { FieldError, FieldLabel } from "@/components/field-parts";
import { FramedAvatar } from "@/components/framed-avatar";
import type { Contact, WalletMeta } from "@/store/persisted";
import type { SessionAccount } from "@/lib/session-account";
import { identityDisplayName } from "./multisig-ui";

const ROW_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  minHeight: 44,
  minWidth: 0,
} as const;

function InlineError({ message, warning = false }: { message: string; warning?: boolean }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        margin: 0,
        padding: "var(--space-2) var(--space-3)",
        border: `1px solid ${warning ? "var(--color-status-warning)" : "var(--color-status-error)"}`,
        borderRadius: "var(--radius-sharp)",
        background: warning ? "var(--color-status-warning-soft)" : "var(--color-status-error-soft)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        lineHeight: "var(--leading-body)",
        color: warning ? "var(--color-status-warning)" : "var(--color-status-error)",
        overflowWrap: "anywhere",
      }}
    >
      {message}
    </p>
  );
}

function OwnerAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ border: 0, background: "transparent", padding: 0, display: "flex", color: "var(--color-text-tertiary)", cursor: "pointer", flexShrink: 0 }}
    >
      {children}
    </button>
  );
}

/** Full-screen owner editor for a new multisig vault. */
export function MultisigOwnersEditor({
  activeAccountName,
  identity,
  extraOwners,
  ownerRowIds,
  ownerErrors,
  contacts,
  wallet,
  sessionAccounts,
  formError,
  preflightError,
  onRemoveOwner,
}: {
  activeAccountName: string;
  identity: string | null;
  extraOwners: string[];
  ownerRowIds: number[];
  ownerErrors: string[];
  contacts: Contact[];
  wallet: WalletMeta | null;
  sessionAccounts: SessionAccount[];
  formError: string;
  preflightError: string;
  onRemoveOwner: (index: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", width: "100%", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
        <FieldLabel>Owner 1</FieldLabel>
        <div style={ROW_STYLE}>
          <FramedAvatar seed={identity ?? activeAccountName} size={28} />
          <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
              {activeAccountName}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)" }}>
              {identity ? truncateId(identity, 10, 10) : "No active account"}
            </span>
          </span>
        </div>
      </div>

      {extraOwners.map((owner, index) => {
        const ownerNumber = index + 2;
        return (
          <div key={ownerRowIds[index]} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
            <FieldLabel>Owner {ownerNumber}</FieldLabel>
            <div style={ROW_STYLE}>
              <FramedAvatar seed={owner} size={28} />
              <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
                  {identityDisplayName(owner, contacts, wallet, sessionAccounts)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)" }}>
                  {truncateId(owner, 10, 10)}
                </span>
              </span>
              <OwnerAction label={`Remove owner ${ownerNumber}`} onClick={() => onRemoveOwner(index)}>
                <Delete02Icon size={18} aria-hidden="true" />
              </OwnerAction>
            </div>
            {ownerErrors[index] ? <FieldError>{ownerErrors[index]}</FieldError> : null}
          </div>
        );
      })}

      <InlineError message={formError} />
      <InlineError message={preflightError} warning />
    </div>
  );
}
