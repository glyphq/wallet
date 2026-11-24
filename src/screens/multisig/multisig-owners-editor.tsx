import type { CSSProperties } from "react";
import { AddCircleIcon, Delete02Icon, UserGroupIcon } from "@/lib/icons";
import { FramedAvatar } from "@/components/framed-avatar";
import { Input } from "@/components/input";
import { Tag } from "@/components/tag";
import { TextButton } from "@/components/text-button";

const BODY_COPY: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body-compact)",
  lineHeight: "var(--leading-body)",
  color: "var(--color-text-secondary)",
};

const CAPTION_COPY: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--leading-compact)",
  color: "var(--color-text-tertiary)",
  minWidth: 0,
  overflowWrap: "anywhere",
};

const OWNER_CARD_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  minWidth: 0,
  padding: "var(--space-3)",
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-sharp)",
};

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

/** Full-screen owner editor for a new multisig vault. */
export function MultisigOwnersEditor({
  activeAccountName,
  identity,
  extraOwners,
  ownerRowIds,
  ownerErrors,
  ownerCount,
  maxOwners,
  formError,
  preflightError,
  onOwnerChange,
  onAddOwner,
  onRemoveOwner,
  onPickOwner,
}: {
  activeAccountName: string;
  identity: string | null;
  extraOwners: string[];
  ownerRowIds: number[];
  ownerErrors: string[];
  ownerCount: number;
  maxOwners: number;
  formError: string;
  preflightError: string;
  onOwnerChange: (index: number, value: string) => void;
  onAddOwner: () => void;
  onRemoveOwner: (index: number) => void;
  onPickOwner: (index: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", width: "100%", maxWidth: 480, margin: "0 auto" }}>
      <p style={BODY_COPY}>
        Owner 1 is {activeAccountName}. Add at least one more signer for this vault.
      </p>

      <div style={OWNER_CARD_STYLE}>
        <FramedAvatar seed={identity ?? activeAccountName} size={34} />
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)", minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body-compact)",
                fontWeight: 500,
                color: "var(--color-text-primary)",
                minWidth: 0,
                overflowWrap: "anywhere",
              }}
            >
              {activeAccountName}
            </span>
            <Tag>You</Tag>
          </span>
          <span style={CAPTION_COPY}>{identity ?? "No active account"}</span>
        </div>
      </div>

      {extraOwners.map((owner, index) => {
        const ownerNumber = index + 2;
        return (
          <Input
            key={ownerRowIds[index]}
            containerStyle={{ minWidth: 0 }}
            label={`Owner ${ownerNumber}`}
            value={owner}
            onChange={(event) => onOwnerChange(index, event.target.value)}
            placeholder="Identity address"
            error={ownerErrors[index] || undefined}
            autoComplete="off"
            style={{ paddingRight: 84 }}
            rightElement={(
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  onClick={() => onPickOwner(index)}
                  aria-label={`Choose owner ${ownerNumber}`}
                  style={{ border: 0, background: "transparent", padding: 0, display: "flex", color: "var(--color-text-tertiary)", cursor: "pointer" }}
                >
                  <UserGroupIcon size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveOwner(index)}
                  aria-label={`Remove owner ${ownerNumber}`}
                  style={{ border: 0, background: "transparent", padding: 0, display: "flex", color: "var(--color-text-tertiary)", cursor: "pointer" }}
                >
                  <Delete02Icon size={18} aria-hidden="true" />
                </button>
              </span>
            )}
          />
        );
      })}

      <div>
        <TextButton
          onClick={onAddOwner}
          disabled={ownerCount >= maxOwners}
          aria-label="Add owner"
        >
          <AddCircleIcon size={14} strokeWidth={1.5} aria-hidden="true" />
          Add owner
        </TextButton>
      </div>

      <InlineError message={formError} />
      <InlineError message={preflightError} warning />
    </div>
  );
}
