import { useState, useCallback } from "react";
import { Copy01Icon, CheckmarkCircle01Icon } from "@/lib/icons";
import { copyToClipboard } from "@/lib/clipboard";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500,
  color: "var(--color-text-secondary)",
};

export const CARD_STYLE: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  borderRadius: "var(--radius-card)",
  padding: "var(--space-1) var(--space-4)",
};

export const DIVIDER: React.CSSProperties = {
  height: 1, background: "var(--color-border-subtle)", margin: "0 calc(var(--space-4) * -1)",
};

export function DetailRow({ icon, label, value, valueColor, mono: useMono = true, copyValue }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string; mono?: boolean; copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!copyValue) return;
    await copyToClipboard(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [copyValue]);

  const valueElement = (
    <span
      style={{
        fontFamily: useMono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "var(--text-body)", fontWeight: useMono ? 400 : 500,
        color: valueColor ?? "var(--color-text-display)",
        textAlign: "right", maxWidth: "55%", wordBreak: "break-all",
        textDecoration: copyValue && hovered ? "underline" : "none",
        textUnderlineOffset: 3,
        cursor: copyValue ? "pointer" : "default",
        display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={copyValue ? handleCopy : undefined}
    >
      {value}
      {copyValue && !copied && <Copy01Icon size={12} style={{ flexShrink: 0, opacity: 0.4 }} />}
      {copyValue && copied && <CheckmarkCircle01Icon size={12} style={{ flexShrink: 0, color: "var(--color-status-success)" }} />}
    </span>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) 0" }}>
      <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}>{icon}</span>
      <span style={{ ...labelStyle, flex: 1 }}>{label}</span>
      {valueElement}
    </div>
  );
}
