import { useState, type CSSProperties, type ReactNode } from "react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@/lib/icons";
import { IconButton } from "@/components/icon-button";
import { Identicon } from "@/components/identicon";
import { ContractMark } from "@/components/contract-mark";
import { copyToClipboard } from "@/lib/clipboard";

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

export function TxBox({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        minHeight: 46,
        padding: "var(--space-3) var(--space-4)",
        background: "var(--color-bg-surface)",
        borderRadius: 6,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <IconButton
      label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      onClick={() => void copy()}
      style={{ width: 26, height: 26, flexShrink: 0 }}
    >
      {copied ? (
        <CheckmarkCircle01Icon size={14} color="var(--color-status-success)" aria-hidden="true" />
      ) : (
        <Copy01Icon size={14} aria-hidden="true" />
      )}
    </IconButton>
  );
}

export function IdentityValue({ identity }: { identity: string }) {
  return (
    <>
      <Identicon kind="identity" seed={identity} size={22} radius={999} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.02em", overflowWrap: "anywhere" }}>
        {identity}
      </span>
      <CopyButton value={identity} label="identity" />
    </>
  );
}

export function ContractValue({ name, address }: { name: string; address: string }) {
  return (
    <>
      <span style={{ display: "inline-flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ContractMark name={name} size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.02em", overflowWrap: "anywhere" }}>
        {name}
      </span>
      <CopyButton value={address} label="contract address" />
    </>
  );
}

export function StatChip({ children, tone }: { children: ReactNode; tone?: "success" | "warning" | "error" }) {
  const color = tone === "success"
    ? "var(--color-status-success)"
    : tone === "warning"
      ? "var(--color-status-warning)"
      : tone === "error"
        ? "var(--color-status-error)"
        : "var(--color-text-primary)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: tone ? `color-mix(in srgb, ${color} 12%, var(--color-bg-surface))` : "var(--color-bg-surface)",
        color,
        borderRadius: 6,
        padding: "4px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        lineHeight: 1.35,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
