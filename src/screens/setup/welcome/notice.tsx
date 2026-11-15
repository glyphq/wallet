import type { CSSProperties, ReactNode } from "react";
import { Alert01Icon } from "@/lib/icons";

const noticeStyle: Record<"warning" | "error", CSSProperties> = {
  warning: {
    color: "var(--color-status-warning)",
    borderColor: "color-mix(in srgb, var(--color-status-warning) 45%, transparent)",
    background: "color-mix(in srgb, var(--color-status-warning) 10%, var(--color-bg-surface))",
  },
  error: {
    color: "var(--color-status-error)",
    borderColor: "color-mix(in srgb, var(--color-status-error) 45%, transparent)",
    background: "color-mix(in srgb, var(--color-status-error) 10%, var(--color-bg-surface))",
  },
};

export function Notice({ tone, children }: { tone: "warning" | "error"; children: ReactNode }) {
  const colors = noticeStyle[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        border: `1px solid ${colors.borderColor}`,
        borderRadius: "var(--radius-surface)",
        background: colors.background,
      }}
    >
      <Alert01Icon size={16} color={colors.color} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-body-compact)",
          lineHeight: "var(--leading-body)",
          color: colors.color,
        }}
      >
        {children}
      </span>
    </div>
  );
}
