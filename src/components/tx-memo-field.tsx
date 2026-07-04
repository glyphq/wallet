import { useState } from "react";
import { NotesMinimalistic } from "@solar-icons/react";
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
    <div style={{
      background: "var(--color-bg-surface)",
      borderRadius: "var(--radius-card)",
      padding: "14px 16px",
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
    }}>
      <NotesMinimalistic size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)", marginTop: 2 }} />
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={save}
        placeholder="Add a note"
        rows={2}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          outline: "none",
          color: "var(--color-text-display)",
          fontFamily: "var(--font-sans)",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          padding: 0,
          resize: "none",
          boxSizing: "border-box",
          minWidth: 0,
        }}
      />
    </div>
  );
}
