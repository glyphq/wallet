import { ShieldAlert } from "lucide-react";
import { Tag } from "@/components/tag";

export interface DappInfo {
  name: string;
  origin: string;
  icon?: string;
}

interface RequestHeaderProps {
  dapp: DappInfo;
}

export function RequestHeader({ dapp }: RequestHeaderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
          <ShieldAlert size={11} color="var(--color-status-warning)" strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            DEEP LINK SENDER
          </span>
        </div>
        <Tag variant="warning">UNVERIFIED</Tag>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
          Treat the sender as unknown unless you independently verify it.
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
          self-reported origin: {dapp.origin || "—"}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
          self-reported name: {dapp.name || "—"}
        </div>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>
        [SELF-REPORTED METADATA IS NOT AN AUTHENTICATED DAPP IDENTITY.]
      </div>
    </div>
  );
}
