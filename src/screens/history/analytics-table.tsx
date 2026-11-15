import type { ReactNode } from "react";
import { Identicon } from "@/components/identicon";
import type { RankedItem } from "./analytics-helpers";

export function ReportSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-6) 0",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
          {title}
        </h2>
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

export function RankedList({ items }: { items: RankedItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, index) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gridTemplateColumns: "36px minmax(0, 1fr) auto",
            alignItems: "center",
            gap: "var(--space-3)",
            minHeight: 62,
            borderTop: index > 0 ? "1px solid var(--color-border-subtle)" : undefined,
          }}
        >
          <Identicon kind="identity" seed={item.id} label={item.primary} size={36} radius={9} style={{ flexShrink: 0, opacity: item.kind === "contract" ? 0.82 : 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.primary}
            </div>
            <div style={{ marginTop: 3, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.secondary}
            </div>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DataRow({ primary, secondary, value, bordered = false }: { primary: string; secondary: string; value: string; bordered?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: "var(--space-3)", minHeight: 52, borderTop: bordered ? "1px solid var(--color-border-subtle)" : undefined }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {primary}
        </div>
        <div style={{ marginTop: 2, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
          {secondary}
        </div>
      </div>
      <span style={{ maxWidth: 140, fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}
