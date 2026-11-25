import { useState, type ReactNode } from "react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@/lib/icons";
import { IconButton } from "@/components/icon-button";
import { copyToClipboard } from "@/lib/clipboard";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

export function DetailRow({
  label,
  value,
  copyValue,
  mono = true,
}: {
  label: string;
  value: string;
  copyValue?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!copyValue) return;
    await copyToClipboard(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, padding: "var(--space-2) 0" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
        {label}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", minWidth: 0 }}>
        <span
          style={{
            minWidth: 0,
            fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
            fontSize: mono ? "var(--text-mono-sm)" : "var(--text-label)",
            color: "var(--color-text-primary)",
            overflowWrap: "anywhere",
            fontVariantNumeric: mono ? "tabular-nums" : undefined,
          }}
        >
          {value}
        </span>
        {copyValue ? (
          <IconButton
            label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
            onClick={() => void copy()}
            style={{ width: 24, height: 24, flexShrink: 0 }}
          >
            {copied ? (
              <CheckmarkCircle01Icon size={13} color="var(--color-status-success)" aria-hidden="true" />
            ) : (
              <Copy01Icon size={13} aria-hidden="true" />
            )}
          </IconButton>
        ) : null}
      </span>
    </div>
  );
}
