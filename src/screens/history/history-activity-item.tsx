import { ArrowDownLeft01Icon, ArrowUpRight01Icon, Clock01Icon, FlashIcon, ShieldAlertIcon } from "@/lib/icons";

const TX_TYPE_ICONS: Record<string, typeof ArrowUpRight01Icon> = {
  sent: ArrowUpRight01Icon,
  received: ArrowDownLeft01Icon,
  sc: FlashIcon,
  failed: ShieldAlertIcon,
  pending: Clock01Icon,
};

export function ActivityItem({ onClick, label, labelColor, address, time, amount, amountUsd, amountColor, className, txType }: {
  onClick: () => void;
  label: string;
  labelColor: string;
  address: string;
  time: string;
  amount: string;
  amountUsd?: string;
  amountColor: string;
  className?: string;
  txType?: "sent" | "received" | "sc" | "failed" | "pending";
}) {
  const TypeIcon = txType ? TX_TYPE_ICONS[txType] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`history-row${className ? ` ${className}` : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        width: "100%", background: "none", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left",
      }}
    >
      {TypeIcon && (
        <div style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-sharp)",
          border: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-surface)",
          color: txType === "failed" ? "var(--color-status-warning)" : txType === "pending" ? "var(--color-text-disabled)" : "var(--color-text-secondary)",
        }}>
          <TypeIcon size={20} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: labelColor }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
          {address}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>
          {time}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: amountColor, fontVariantNumeric: "tabular-nums" }}>
          {amount}
        </span>
        {amountUsd && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", fontVariantNumeric: "tabular-nums" }}>
            {amountUsd}
          </span>
        )}
      </div>
    </button>
  );
}
