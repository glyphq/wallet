import { motion } from "motion/react";

interface SettingsSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function SettingsSwitch({ label, description, checked, onChange, disabled = false }: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        minHeight: 44, padding: "var(--space-3) 0", width: "100%",
        background: "none", border: "none",
        cursor: disabled ? "default" : "pointer", textAlign: "left",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          {label}
        </span>
        <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 36, height: 20, borderRadius: "var(--radius-pill)",
          flexShrink: 0, position: "relative",
          background: checked ? "var(--color-accent)" : "var(--color-border-strong)",
        }}
      >
        <motion.span
          animate={{ x: checked ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            display: "block", width: 16, height: 16, borderRadius: "50%",
            background: checked ? "var(--color-bg-base)" : "var(--color-text-disabled)",
            position: "absolute", top: 2,
          }}
        />
      </span>
    </button>
  );
}
