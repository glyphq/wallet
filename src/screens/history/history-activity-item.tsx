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
      {TypeIcon && (
        <div
          className="history-tx-icon corner-frame"
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sharp)",
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
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", minWidth: 0 }}>
          <span
            style={{
              minWidth: 0,
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
          {time ? (
            <span
              style={{
                flexShrink: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                color: "var(--color-text-tertiary)",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}
            >
              {time}
            </span>
          ) : null}
        </div>
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
        {amountUsd ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-caption)",
              color: "var(--color-text-tertiary)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {amountUsd}
          </span>
        ) : null}
      </div>
    </button>
  );
}
