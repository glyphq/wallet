import { useState } from "react";
import { Textarea } from "@/components/textarea";
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
    <Textarea
      label="Note"
      value={memo}
      onChange={(event) => setMemo(event.target.value)}
      onBlur={save}
      placeholder="Add a note"
      rows={2}
      style={{ minHeight: 72 }}
    />
  );
}
