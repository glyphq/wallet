export interface DappInfo {
  name: string;
  origin: string;
  icon?: string;
}

export function RequestHeader({ dapp, action }: { dapp: DappInfo; action: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-section)", lineHeight: "var(--leading-tight)", color: "var(--color-text-secondary)" }}>
        <span style={{ fontWeight: 600, color: "var(--color-text-display)" }}>{dapp.name || "Unknown app"}</span>
        {" "}wants to{" "}
        <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{action}</span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
        {dapp.origin}
      </div>
    </div>
  );
}
