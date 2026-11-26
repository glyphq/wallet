import { QrCodeIcon } from "@/lib/icons";

export function ReceiveEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-6) var(--space-4)",
        textAlign: "center",
      }}
    >
      <QrCodeIcon size={28} aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-compact)",
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          No account selected
        </span>
        <span
          style={{
            maxWidth: 280,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-body)",
            color: "var(--color-text-tertiary)",
          }}
        >
          Select an account on the dashboard to view its receive address.
        </span>
      </div>
    </div>
  );
}
