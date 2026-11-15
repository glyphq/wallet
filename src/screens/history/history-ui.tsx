import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Input } from "@/components/input";
import { sanitize, type DraftInputs, type TxFilters } from "./history-utils";

export const INPUT_SM: React.CSSProperties = { fontSize: "var(--text-mono-sm)", padding: "var(--space-2) var(--space-3)" };

export const FILTER_SIDEBAR: React.CSSProperties = {
  width: 212,
  flexShrink: 0,
  borderRight: "1px solid var(--color-border-subtle)",
  overflowY: "auto",
  padding: "var(--space-4) var(--space-3)",
};

export const FILTER_SHEET_BODY: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--space-1)" };

export const FILTER_FOOTER: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };

export const GHOST_BTN: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
  color: "var(--color-text-disabled)", padding: 0,
};

export const APPLY_BTN: React.CSSProperties = {
  background: "var(--color-text-primary)", border: "none",
  borderRadius: "var(--radius-sharp)", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
  color: "var(--color-bg-base)",
  padding: "var(--space-2) var(--space-4)",
};

export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{ padding: "var(--space-3) 0", borderTop: "1px solid var(--color-border-subtle)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>{children}</div>
    </section>
  );
}

export function FilterHeader({ title, active, onReset }: { title: string; active: boolean; onReset: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)", paddingBottom: "var(--space-3)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>{title}</div>
      {active && <button type="button" onClick={onReset} style={GHOST_BTN}>Reset</button>}
    </div>
  );
}

export function HistoryFilterControls({
  filters, draft, groupByCounterparty, commitOnFieldBlur = false, setFilters, setDraft, setGroupByCounterparty,
}: {
  filters: TxFilters;
  draft: DraftInputs;
  groupByCounterparty: boolean;
  commitOnFieldBlur?: boolean;
  setFilters: Dispatch<SetStateAction<TxFilters>>;
  setDraft: Dispatch<SetStateAction<DraftInputs>>;
  setGroupByCounterparty: Dispatch<SetStateAction<boolean>>;
}) {
  const fieldBlur = (key: keyof DraftInputs) => commitOnFieldBlur ? () => setFilters((f) => ({ ...f, [key]: key.includes("Amount") || key.includes("tick") ? sanitize(draft[key]) : draft[key] })) : undefined;
  return (
    <>
      <FilterSection label="Direction">
        {(["all", "in", "out"] as const).map((v) => (
          <FilterChoice key={v} label={v === "all" ? "All" : v === "in" ? "Incoming" : "Outgoing"} active={filters.direction === v} onClick={() => setFilters((f) => ({ ...f, direction: v }))} />
        ))}
      </FilterSection>
      <FilterSection label="Type">
        {(["all", "transfer", "sc"] as const).map((v) => (
          <FilterChoice key={v} label={v === "all" ? "All" : v === "sc" ? "SC calls" : "Transfers"} active={filters.type === v} onClick={() => setFilters((f) => ({ ...f, type: v }))} />
        ))}
      </FilterSection>
      <FilterSection label="Date range">
        <RangeInputs fromValue={draft.dateFrom} fromPlaceholder="From" toValue={draft.dateTo} toPlaceholder="To" type="date" onFromBlur={fieldBlur("dateFrom")} onToBlur={fieldBlur("dateTo")} onFromChange={(v) => setDraft((d) => ({ ...d, dateFrom: v }))} onToChange={(v) => setDraft((d) => ({ ...d, dateTo: v }))} />
      </FilterSection>
      <FilterSection label="Amount (QU)">
        <RangeInputs fromValue={draft.minAmount} fromPlaceholder="Min" toValue={draft.maxAmount} toPlaceholder="Max" onFromBlur={fieldBlur("minAmount")} onToBlur={fieldBlur("maxAmount")} onFromChange={(v) => setDraft((d) => ({ ...d, minAmount: v.replace(/\D/g, "") }))} onToChange={(v) => setDraft((d) => ({ ...d, maxAmount: v.replace(/\D/g, "") }))} />
      </FilterSection>
      <FilterSection label="Tick range">
        <RangeInputs fromValue={draft.tickFrom} fromPlaceholder="From" toValue={draft.tickTo} toPlaceholder="To" onFromBlur={fieldBlur("tickFrom")} onToBlur={fieldBlur("tickTo")} onFromChange={(v) => setDraft((d) => ({ ...d, tickFrom: v.replace(/\D/g, "") }))} onToChange={(v) => setDraft((d) => ({ ...d, tickTo: v.replace(/\D/g, "") }))} />
      </FilterSection>
      <FilterSection label="Group by">
        <FilterChoice label="None" active={!groupByCounterparty} onClick={() => setGroupByCounterparty(false)} />
        <FilterChoice label="Counterparty" active={groupByCounterparty} onClick={() => setGroupByCounterparty(true)} />
      </FilterSection>
    </>
  );
}

function RangeInputs({ fromValue, toValue, fromPlaceholder, toPlaceholder, type, onFromChange, onToChange, onFromBlur, onToBlur }: {
  fromValue: string; toValue: string; fromPlaceholder: string; toPlaceholder: string;
  type?: "date"; onFromChange: (v: string) => void; onToChange: (v: string) => void; onFromBlur?: () => void; onToBlur?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%" }}>
      <Input type={type} value={fromValue} onChange={(e) => onFromChange(e.target.value)} onBlur={onFromBlur} placeholder={fromPlaceholder} inputMode={type === "date" ? undefined : "numeric"} style={INPUT_SM} containerStyle={{ flex: 1, minWidth: 0 }} />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", flexShrink: 0 }}>–</span>
      <Input type={type} value={toValue} onChange={(e) => onToChange(e.target.value)} onBlur={onToBlur} placeholder={toPlaceholder} inputMode={type === "date" ? undefined : "numeric"} style={INPUT_SM} containerStyle={{ flex: 1, minWidth: 0 }} />
    </div>
  );
}

function FilterChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none",
      border: "none",
      borderBottom: `1px solid ${active ? "var(--color-text-primary)" : "var(--color-border-subtle)"}`,
      cursor: "pointer",
      fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
      color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      padding: "var(--space-2) var(--space-2) var(--space-1)",
    }}>
      {label}
    </button>
  );
}

export function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} style={{
      background: "none", border: "none", borderBottom: "1px solid var(--color-text-primary)", cursor: "pointer",
      fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
      color: "var(--color-text-primary)",
      padding: "var(--space-1) 0",
      display: "flex", alignItems: "center", gap: "var(--space-1)",
    }}>
      {label} <span style={{ fontSize: "var(--text-caption)", lineHeight: 1 }}>✕</span>
    </button>
  );
}

export function ExportAction({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none", borderBottom: "1px solid var(--color-border-subtle)", cursor: "pointer",
      fontFamily: "var(--font-sans)", color: "var(--color-text-primary)",
      padding: "var(--space-4) 0", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left",
    }}>
      <span style={{ fontSize: "var(--text-body)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{detail}</span>
    </button>
  );
}

export function StatusText({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color }}>
      {children}
    </div>
  );
}
