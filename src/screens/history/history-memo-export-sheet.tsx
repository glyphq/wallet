import { useState } from "react";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import { downloadText } from "./history-utils";
import { APPLY_BTN, FilterSection, GHOST_BTN, INPUT_SM } from "./history-ui";

export function HistoryMemoExportSheet({
  open, txs, memos, onClose,
}: {
  open: boolean;
  txs: TxHistoryItem[];
  memos: Record<string, string>;
  onClose: () => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");

  function exportMemos() {
    let entries = Object.entries(memos).filter(([, v]) => v.trim());
    // Apply date and amount filters by matching against txs
    if (dateFrom || dateTo || minAmount) {
      const from = dateFrom ? new Date(dateFrom).getTime() : 0;
      const to = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
      const minAmt = minAmount ? BigInt(minAmount) : 0n;
      const txMap = new Map(txs.map((tx) => [tx.hash, tx]));
      entries = entries.filter(([hash]) => {
        const tx = txMap.get(hash);
        if (!tx) return true;
        if (tx.timestamp && (tx.timestamp < from || tx.timestamp > to)) return false;
        try { if (BigInt(tx.amount ?? "0") < minAmt) return false; } catch { /* ignore */ }
        return true;
      });
    }
    if (!entries.length) return;
    downloadText(`glyph-memos-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(Object.fromEntries(entries), null, 2), "application/json");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Export memos"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setMinAmount(""); }} style={GHOST_BTN}>Reset</button>
          <button type="button" onClick={exportMemos} style={APPLY_BTN}>Export JSON</button>
        </div>
      }
    >
      <FilterSection label="Date range">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%" }}>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={INPUT_SM} containerStyle={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", flexShrink: 0 }}>–</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={INPUT_SM} containerStyle={{ flex: 1 }} />
        </div>
      </FilterSection>
      <FilterSection label="Min amount (QU)">
        <Input value={minAmount} onChange={(e) => setMinAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" style={INPUT_SM} containerStyle={{ width: "100%" }} />
      </FilterSection>
    </Sheet>
  );
}
