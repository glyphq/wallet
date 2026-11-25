import type { CSSProperties, ReactNode } from "react";
import { FramedAvatar } from "@/components/framed-avatar";
import { ContractMark } from "@/components/contract-mark";
import { truncateId } from "@/lib/format";

export function TxSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", paddingLeft: 2 }}>
        {label}
      </span>
      {children}
    </section>
  );
}

export function TxBox({
  children,
  style,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const boxStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    width: "100%",
    minHeight: 46,
    padding: "var(--space-3) var(--space-4)",
    background: "var(--color-bg-surface)",
    border: 0,
    borderRadius: 6,
    minWidth: 0,
    color: "inherit",
    textAlign: "left",
    ...(onClick ? { cursor: "pointer" } : null),
    ...style,
  };

  if (onClick) {
    return (
      <button type="button" aria-label={ariaLabel} onClick={onClick} style={boxStyle}>
        {children}
      </button>
    );
  }
  return <div style={boxStyle}>{children}</div>;
}

export function IdentityValue({ identity }: { identity: string }) {
  return (
    <>
      <FramedAvatar seed={identity} size={22} />
      <span title={identity} style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {truncateId(identity, 8, 8)}
      </span>
    </>
  );
}

export function ContractValue({ name }: { name: string }) {
  return (
    <>
      <span style={{ display: "inline-flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ContractMark name={name} size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.02em", overflowWrap: "anywhere" }}>
        {name}
      </span>
    </>
  );
}

export function StatChip({
  children,
  tone,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "error";
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const color = tone === "success"
    ? "var(--color-status-success)"
    : tone === "warning"
      ? "var(--color-status-warning)"
      : tone === "error"
        ? "var(--color-status-error)"
        : "var(--color-text-primary)";

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    background: tone ? `color-mix(in srgb, ${color} 12%, var(--color-bg-surface))` : "var(--color-bg-surface)",
    color,
    border: 0,
    borderRadius: 6,
    padding: "4px 10px",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-mono-sm)",
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    cursor: onClick ? "pointer" : "default",
  };

  if (onClick) {
    return <button type="button" aria-label={ariaLabel} onClick={onClick} style={style}>{children}</button>;
  }
  return <span style={style}>{children}</span>;
}
