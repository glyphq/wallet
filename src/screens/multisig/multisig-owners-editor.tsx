import type { ReactNode } from "react";
import { truncateId } from "@/lib/format";
import { Delete02Icon, UserGroupIcon } from "@/lib/icons";
import { EmbeddedInput } from "@/components/embedded-input";
import { FieldError, FieldLabel } from "@/components/field-parts";
import { FramedAvatar } from "@/components/framed-avatar";

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
  formError,
  preflightError,
  onOwnerChange,
  onRemoveOwner,
  onPickOwner,
}: {
  activeAccountName: string;
  identity: string | null;
  extraOwners: string[];
  ownerRowIds: number[];
  ownerErrors: string[];
  formError: string;
  preflightError: string;
  onOwnerChange: (index: number, value: string) => void;
  onRemoveOwner: (index: number) => void;
  onPickOwner: (index: number) => void;
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
        const inputId = `owner-${ownerRowIds[index]}`;
        return (
          <div key={ownerRowIds[index]} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
            <FieldLabel htmlFor={inputId}>Owner {ownerNumber}</FieldLabel>
            <div style={ROW_STYLE}>
              <EmbeddedInput
                id={inputId}
                value={owner}
                onChange={(event) => onOwnerChange(index, event.target.value)}
                placeholder="Identity address"
                autoComplete="off"
                style={{ flex: 1, minWidth: 0 }}
              />
              <OwnerAction label={`Choose owner ${ownerNumber}`} onClick={() => onPickOwner(index)}>
                <UserGroupIcon size={18} aria-hidden="true" />
              </OwnerAction>
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
