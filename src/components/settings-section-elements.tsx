import type { ReactNode } from "react";
import { ChevronRight01Icon } from "@/lib/icons";

export function SettingsMenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
      </div>
      <div className="settings-menu corner-frame">{children}</div>
    </section>
  );
}

export function SettingsMenuRow({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="settings-menu-row" onClick={onClick}>
      <span aria-hidden="true" style={{ width: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)" }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {description}
        </span>
      </span>
      <ChevronRight01Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-text-tertiary)" }} />
    </button>
  );
}

export function SettingsSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
      fontWeight: 600, color: "var(--color-text-disabled)",
      textTransform: "none", letterSpacing: "0.06em",
    }}>
      {children}
    </span>
  );
}

export function SettingsDivider() {
  return <div style={{ height: 1, background: "var(--color-border-subtle)" }} />;
}
