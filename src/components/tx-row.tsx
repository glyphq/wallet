import type { ReactNode } from "react";

export interface TxRowProps {
  tag: ReactNode;
  sub: string;
  sub2?: string;
  amount: string;
  amountSecondary?: string;
  amountColor: string;
}

export function TxRow({ tag, sub, sub2, amount, amountSecondary, amountColor }: TxRowProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ marginBottom: "var(--space-1)" }}>{tag}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>{sub}</div>
        {sub2 && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginTop: 2 }}>{sub2}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: "var(--space-3)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: amountColor }}>
          {amount}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>QU</div>
        {amountSecondary && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginTop: 2 }}>
            {amountSecondary}
          </div>
        )}
      </div>
    </div>
  );
}
