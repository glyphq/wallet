import { useState } from "react";
import { Note01Icon } from "@/lib/icons";

export function TxDetailMemo({ memo, onSave }: { memo: string; onSave: (next: string) => void }) {
  const [value, setValue] = useState(memo);
  const [editing, setEditing] = useState(false);

  function save() {
    onSave(value.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{
        background: "var(--color-bg-surface)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-4) var(--space-4)",
        display: "flex", flexDirection: "column", gap: "var(--space-3)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <Note01Icon size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)", marginTop: 2 }} />
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a note"
            rows={2}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--color-text-display)", fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)", lineHeight: 1.5, padding: 0, resize: "none",
              boxSizing: "border-box", minWidth: 0,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
          <button type="button" onClick={() => { setValue(memo); setEditing(false); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-disabled)", padding: "var(--space-1) var(--space-2)" }}>Cancel</button>
          <button type="button" onClick={save} style={{ background: "none", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)", padding: "var(--space-1) var(--space-3)" }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--color-bg-surface)",
      borderRadius: "var(--radius-card)",
      padding: "var(--space-4) var(--space-4)",
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      cursor: "pointer",
    }} onClick={() => setEditing(true)}>
      <Note01Icon size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)", marginTop: 2 }} />
      {value.trim() ? (
        <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-display)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value.trim()}</span>
      ) : (
        <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)", lineHeight: 1.5 }}>Add a note</span>
      )}
    </div>
  );
}
