import type { CSSProperties, ReactNode } from "react";
import { AppShell } from "@/layouts/app-shell";
import { ChoiceChips } from "@/components/choice-chips";

export type StakeTab = "lock" | "unlock";

export const labelStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-tertiary)",
};

export const valueStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  color: "var(--color-text-primary)",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

/** Sticky-footer shell shared by every stake step. */
export function StakeFlowShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <AppShell fullBleed contentStyle={{ overflow: "hidden", padding: 0 }}>
      <div style={{ display: "flex", flex: 1, height: "100%", minHeight: 0, minWidth: 0, flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto", padding: "var(--screen-padding)" }}>
          {children}
        </div>
        {footer ? (
          <div style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--screen-padding)" }}>
            {footer}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export function StakeActionChips({ tab, onChange }: { tab: StakeTab; onChange: (tab: StakeTab) => void }) {
  return (
    <ChoiceChips<StakeTab>
      label="Stake action"
      options={[
        { value: "lock", label: "Lock" },
        { value: "unlock", label: "Unlock" },
      ]}
      selected={tab}
      onSelect={onChange}
    />
  );
}
