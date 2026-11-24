import { useState, type ReactNode } from "react";
import { Identicon } from "@/components/identicon";
import { IdentityDisplay } from "@/components/identity-display";
import { formatQu } from "@/lib/format";
import { CheckmarkCircle01Icon, PencilEdit01Icon } from "@/lib/icons";
import type { AccountMeta } from "@/store/persisted";

export interface AccountRowProps {
  account: AccountMeta;
  identity: string | null;
  isCurrent: boolean;
  dimmed?: boolean;
  flashSuccess?: boolean;
  balance?: bigint | null;
  hideBalances: boolean;
  onManage: () => void;
}

export function AccountRow({ account, identity, isCurrent, dimmed, flashSuccess, balance, hideBalances, onManage }: AccountRowProps) {
  const tags = account.tags ?? [];
  const note = account.note?.trim() ?? "";
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={`stagger-item${flashSuccess ? " flash-success" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onManage}
      style={{
        opacity: dimmed ? 0.55 : 1,
        background: hovered ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-3)",
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "background 0.12s ease, border-color 0.12s ease",
      }}
    >
      <Identicon kind="account" code={`A${account.index + 1}`} seed={identity ?? account.name} label={account.name} size={40} radius={8} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: 2 }}>
              {account.name}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              ACCOUNT {account.index + 1}
            </div>
          </div>
          {balance !== null && balance !== undefined ? (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-display)", flexShrink: 0 }}>
              {hideBalances ? "••••••" : formatQu(balance)}
            </span>
          ) : (
            <span
              style={{
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-mono-sm)",
                color: "var(--color-text-secondary)",
                letterSpacing: "0.05em",
                padding: "var(--space-1) var(--space-2)",
                flexShrink: 0,
              }}
            >
              Manage
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {isCurrent && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-accent)", letterSpacing: "0.05em" }}>
              <CheckmarkCircle01Icon size={14} strokeWidth={1.5} aria-hidden="true" /> Active
            </span>
          )}
          {account.hidden && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              Hidden
            </span>
          )}
          {tags.map((tag) => (
            <span key={tag} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
              #{tag}
            </span>
          ))}
        </div>
        {note && (
          <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {note}
          </div>
        )}
        {identity && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <IdentityDisplay identity={identity} showIdenticon={false} />
          </div>
        )}
      </div>
    </button>
  );
}

export function ActionSection({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: danger ? "var(--color-status-error)" : "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
        {title}
      </div>
      <div style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        {children}
      </div>
    </section>
  );
}

export function ActionRow({
  title,
  description,
  icon: Icon,
  selected,
  disabled,
  danger,
  onClick,
}: {
  title: string;
  description: string;
  icon?: typeof PencilEdit01Icon;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const muted = disabled && !selected;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--color-border-subtle)",
        borderRadius: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: muted ? 0.55 : 1,
        padding: "var(--space-3) 0",
        transform: "none",
      }}
    >
      {Icon && (
        <Icon size={18} strokeWidth={1.5} color={danger ? "var(--color-status-error)" : "var(--color-text-secondary)"} aria-hidden="true" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: danger ? "var(--color-status-error)" : "var(--color-text-display)" }}>
          {title}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      {selected ? (
        <CheckmarkCircle01Icon size={18} strokeWidth={1.5} color="var(--color-accent)" aria-label="Selected" />
      ) : (
        <span style={{ width: 18, height: 18, border: "1px solid var(--color-border-strong)", borderRadius: "999px", flexShrink: 0 }} aria-hidden="true" />
      )}
    </button>
  );
}
