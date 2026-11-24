import { ChevronRight01Icon } from "@/lib/icons";
import type { ApprovedDapp } from "@/store/persisted";

export function DappRow({ dapp, onOpen }: { dapp: ApprovedDapp; onOpen: () => void }) {
  return (
    <button type="button" className="dapp-row" onClick={onOpen}>
      <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-1)", textAlign: "left" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          {dapp.name}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {dapp.origin}
        </span>
      </span>
      <ChevronRight01Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-text-tertiary)" }} />
    </button>
  );
}
