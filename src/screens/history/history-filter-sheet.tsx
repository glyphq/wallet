import type { Dispatch, SetStateAction } from "react";
import { Sheet } from "@/components/sheet";
import {
  APPLY_BTN,
  FILTER_FOOTER,
  FILTER_SHEET_BODY,
  GHOST_BTN,
  HistoryFilterControls,
} from "./history-ui";
import type { DraftInputs, TxFilters } from "./history-utils";

export function HistoryFilterSheet({
  open, active, filters, draft, groupByCounterparty, setFilters, setDraft, setGroupByCounterparty, onApply, onReset, onClose,
}: {
  open: boolean;
  active: boolean;
  filters: TxFilters;
  draft: DraftInputs;
  groupByCounterparty: boolean;
  setFilters: Dispatch<SetStateAction<TxFilters>>;
  setDraft: Dispatch<SetStateAction<DraftInputs>>;
  setGroupByCounterparty: Dispatch<SetStateAction<boolean>>;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filter history"
      footer={
        <div style={FILTER_FOOTER}>
          {active ? (
            <button type="button" onClick={onReset} style={GHOST_BTN}>
              Reset all
            </button>
          ) : <span />}
          <button type="button" onClick={onApply} style={APPLY_BTN}>Apply</button>
        </div>
      }
    >
      <div style={FILTER_SHEET_BODY}>
        <HistoryFilterControls
          filters={filters}
          draft={draft}
          groupByCounterparty={groupByCounterparty}
          setFilters={setFilters}
          setDraft={setDraft}
          setGroupByCounterparty={setGroupByCounterparty}
        />
      </div>
    </Sheet>
  );
}
