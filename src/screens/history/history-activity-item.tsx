import type { ReactNode } from "react";
import { ArrowDownLeft01Icon, ArrowUpRight01Icon, Clock01Icon, FlashIcon, ShieldAlertIcon } from "@/lib/icons";

const TX_TYPE_ICONS: Record<string, typeof ArrowUpRight01Icon> = {
  sent: ArrowUpRight01Icon,
  received: ArrowDownLeft01Icon,
  sc: FlashIcon,
  failed: ShieldAlertIcon,
  pending: Clock01Icon,
};

export function ActivityItem({ onClick, label, labelColor, address, time, amount, amountColor, className, txType, leading }: {
  onClick: () => void;
  label: string;
  labelColor: string;
  address: string;
  time: string;
  amount: string;
  amountColor: string;
  className?: string;
  txType?: "sent" | "received" | "sc" | "failed" | "pending";
  leading?: ReactNode;
}) {
  const TypeIcon = txType ? TX_TYPE_ICONS[txType] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`history-row${className ? ` ${className}` : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: 64,
        background: "none",
        border: "none",
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer",
        padding: "var(--space-3) var(--space-2)",
        margin: "0 calc(var(--space-2) * -1)",
        textAlign: "left",
      }}
    >
      {leading ?? (TypeIcon ? (
        <div
          className="history-tx-icon corner-frame"
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 2,
            border: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface)",
            color: txType === "failed"
              ? "var(--color-status-warning)"
              : txType === "pending"
                ? "var(--color-text-tertiary)"
                : "var(--color-text-secondary)",
          }}
        >
          <TypeIcon size={18} aria-hidden="true" />
        </div>
      ) : null)}

      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-compact)",
            fontWeight: 500,
            color: labelColor,
          }}
        >
          {label}
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.04em",
          }}
        >
          {address}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-body-compact)",
            fontWeight: 500,
            color: amountColor,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {amount}
        </span>
        {time ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-caption)",
              color: "var(--color-text-tertiary)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {time}
          </span>
        ) : null}
      </div>
    </button>
  );
}
