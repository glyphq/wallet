import { truncateId } from "@/lib/format";
import { Delete02Icon, UserGroupIcon } from "@/lib/icons";
import { FieldLabel } from "@/components/field-parts";
import { FramedAvatar } from "@/components/framed-avatar";
import { Input } from "@/components/input";
import { Tag } from "@/components/tag";

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
        <div className="corner-frame" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 48, padding: "0 var(--space-3)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)", background: "var(--color-bg-surface)" }}>
          <FramedAvatar seed={identity ?? activeAccountName} size={28} />
          <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
              {activeAccountName}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)" }}>
              {identity ? truncateId(identity, 10, 10) : "No active account"}
            </span>
          </span>
          <Tag>You</Tag>
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

      <InlineError message={formError} />
      <InlineError message={preflightError} warning />
    </div>
  );
}
