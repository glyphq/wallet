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
