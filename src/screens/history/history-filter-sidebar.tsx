import type { Dispatch, SetStateAction } from "react";
import { FILTER_SIDEBAR, FilterHeader, HistoryFilterControls } from "./history-ui";
import type { DraftInputs, TxFilters } from "./history-utils";

export function HistoryFilterSidebar({
  active, filters, draft, groupByCounterparty, setFilters, setDraft, setGroupByCounterparty, onReset,
}: {
  active: boolean;
  filters: TxFilters;
  draft: DraftInputs;
  groupByCounterparty: boolean;
  setFilters: Dispatch<SetStateAction<TxFilters>>;
  setDraft: Dispatch<SetStateAction<DraftInputs>>;
  setGroupByCounterparty: Dispatch<SetStateAction<boolean>>;
  onReset: () => void;
}) {
  return (
    <aside style={FILTER_SIDEBAR} aria-label="History filters">
      <FilterHeader title="Filters" active={active} onReset={onReset} />
      <HistoryFilterControls
        filters={filters}
        draft={draft}
        groupByCounterparty={groupByCounterparty}
        commitOnFieldBlur
        setFilters={setFilters}
        setDraft={setDraft}
        setGroupByCounterparty={setGroupByCounterparty}
      />
    </aside>
  );
}
