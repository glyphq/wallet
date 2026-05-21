import { useState } from "react";
import { usePersistedStore } from "@/store/persisted";

export function TxMemoField({ hash }: { hash: string }) {
  const txMemos = usePersistedStore((s) => s.txMemos);
  const setTxMemo = usePersistedStore((s) => s.setTxMemo);
  const deleteTxMemo = usePersistedStore((s) => s.deleteTxMemo);

  const [memo, setMemo] = useState(txMemos[hash] ?? "");

  function save() {
    if (memo.trim()) setTxMemo(hash, memo.trim());
    else deleteTxMemo(hash);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "1px solid var(--color-border-strong)", paddingTop: "var(--space-4)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Note
      </span>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={save}
        placeholder="Add a private note to this transaction..."
        rows={3}
        style={{
          width: "100%",
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "var(--radius-sharp)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-sm)",
          letterSpacing: "0.04em",
          lineHeight: 1.6,
          padding: "var(--space-2) var(--space-3)",
          resize: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
