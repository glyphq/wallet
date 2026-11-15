import type { ReactNode } from "react";
import { Search01Icon } from "@/lib/icons";

export function SearchEmptyState({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-12) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
      <Search01Icon size={48} strokeWidth={1.5} style={{ color: "var(--color-text-disabled)", opacity: 0.5 }} />
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
        {title}
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", opacity: 0.7 }}>
        {description}
      </div>
    </div>
  );
}
