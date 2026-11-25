import { useState } from "react";
import { Note01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { Textarea } from "@/components/textarea";
import { TextButton } from "@/components/text-button";
import { SectionLabel } from "./tx-detail-ui";

export function TxDetailMemo({ memo, onSave }: { memo: string; onSave: (next: string) => void }) {
  const [value, setValue] = useState(memo);
  const [editing, setEditing] = useState(false);

  function save() {
    onSave(value.trim());
    setEditing(false);
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Note01Icon size={14} aria-hidden="true" color="var(--color-text-tertiary)" />
          <SectionLabel>Note</SectionLabel>
        </span>
        {!editing ? (
          <TextButton tone="muted" onClick={() => setEditing(true)}>
            {value.trim() ? "Edit" : "Add note"}
          </TextButton>
        ) : null}
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Textarea
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Add a note"
            rows={3}
            style={{ minHeight: 96 }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <TextButton
              tone="muted"
              onClick={() => {
                setValue(memo);
                setEditing(false);
              }}
            >
              Cancel
            </TextButton>
            <Button size="sm" style={{ width: "auto" }} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : value.trim() ? (
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
          {value.trim()}
        </p>
      ) : null}
    </section>
  );
}
