import { motion } from "motion/react";
import { Divider } from "@/components/divider";
import { SquareLock01Icon, SquareUnlock01Icon } from "@/lib/icons";

export type StakeTab = "lock" | "unlock";

const rowDivider: React.CSSProperties = {
  margin: "0 calc(var(--space-4) * -1)",
};

export const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-disabled)",
};

export const valueStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  color: "var(--color-text-primary)",
  textAlign: "right",
};

export const sectionStyle: React.CSSProperties = {
  padding: "0 var(--space-4)",
};

export function RowDivider() {
  return <Divider style={rowDivider} />;
}

export function StakeTabBar({ tab, onChange }: { tab: StakeTab; onChange: (tab: StakeTab) => void }) {
  const tabs: { key: StakeTab; label: string; icon: React.ReactNode }[] = [
    { key: "lock", label: "Lock", icon: <SquareLock01Icon size={14} strokeWidth={1.5} /> },
    { key: "unlock", label: "Unlock", icon: <SquareUnlock01Icon size={14} strokeWidth={1.5} /> },
  ];
  return (
    <div style={{ position: "relative", display: "flex", background: "var(--color-bg-surface)", borderRadius: "var(--radius-pill)", padding: "var(--space-1)", gap: 2 }}>
      {tabs.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            flex: 1,
            position: "relative",
            zIndex: 1,
            background: "transparent",
            color: tab === key ? "var(--color-bg-base)" : "var(--color-text-disabled)",
            border: "none",
            borderRadius: "var(--radius-pill)",
            padding: "var(--space-3) 0",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label)",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            transition: "color 0.15s ease",
          }}
        >
          {tab === key && (
            <motion.span
              layoutId="stake-tab-pill"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "var(--radius-pill)",
                background: "var(--color-accent)",
                zIndex: -1,
              }}
            />
          )}
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}
