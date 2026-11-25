import { useState } from "react";
import { CheckmarkCircle01Icon } from "@/lib/icons";
import { IconButton } from "@/components/icon-button";
import { Input } from "@/components/input";

export function TxDetailMemo({ memo, onSave }: { memo: string; onSave: (next: string) => void }) {
  const [value, setValue] = useState(memo);
  const dirty = value.trim() !== memo.trim();

  return (
    <Input
      label="Note"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && dirty) onSave(value.trim());
      }}
      placeholder="Add a note"
      autoComplete="off"
      maxLength={2000}
      rightElement={(
        <IconButton
          label="Save note"
          disabled={!dirty}
          onClick={() => onSave(value.trim())}
          style={{ width: 32, height: 32 }}
        >
          <CheckmarkCircle01Icon
            size={18}
            aria-hidden="true"
            color={dirty ? "var(--color-accent)" : "var(--color-text-tertiary)"}
          />
        </IconButton>
      )}
    />
  );
}
