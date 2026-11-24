import { truncateId } from "@/lib/format";
import { FramedAvatar } from "@/components/framed-avatar";

/** One-line identity display with an account/contact name and compact address. */
export function ApprovalAddress({
  label,
  identity,
  name,
  compact = "long",
}: {
  label: string;
  identity: string;
  name?: string;
  compact?: "short" | "long";
}) {
  const short = compact === "long" ? truncateId(identity, 8, 8) : identity ? `${identity.slice(0, 4)}.${identity.slice(-4)}` : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
        {label}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", alignItems: "center", columnGap: "var(--space-3)", minWidth: 0 }} title={identity}>
        <FramedAvatar seed={identity} size={34} />
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", minWidth: 0, whiteSpace: "nowrap" }}>
          {name ? (
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-compact)", color: "var(--color-text-primary)" }}>
              {name}
            </span>
          ) : null}
          <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.04em", color: "var(--color-text-tertiary)" }}>
            {name ? `(${short})` : short}
          </span>
        </div>
      </div>
    </div>
  );
}
