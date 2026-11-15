/** Bordered switch row used by appearance settings. */
export function SettingsToggleRow({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="settings-pressable"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: "100%",
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-control)",
        color: "var(--color-text-primary)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", lineHeight: "var(--leading-compact)" }}>
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 22,
          flex: "0 0 auto",
          padding: 2,
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--color-accent)" : "var(--color-bg-input)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        <span
          style={{
            display: "block",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: checked ? "var(--color-accent-contrast)" : "var(--color-text-tertiary)",
            transform: checked ? "translateX(16px)" : "translateX(0)",
            transition: "transform var(--duration-fast) var(--ease-out)",
          }}
        />
      </span>
    </button>
  );
}
