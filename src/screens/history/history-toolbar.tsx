import { Download01Icon, FilterIcon, RefreshIcon, ChartLineData01Icon } from "@/lib/icons";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellAccountSwitcher } from "@/components/shell-account-switcher";

export function HistoryToolbar({
  exportDisabled, hasActiveFilters, onViewAnalytics, onExport, onFilter, onRefresh,
}: {
  exportDisabled: boolean;
  hasActiveFilters: boolean;
  onViewAnalytics: () => void;
  onExport: () => void;
  onFilter: () => void;
  onRefresh: () => void;
}) {
  return (
    <ScreenHeader
      leading={<ShellAccountSwitcher />}
      title="History"
      action={
        <>
          <IconButton framed label="View analytics" onClick={onViewAnalytics}>
            <ChartLineData01Icon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton framed label="Export history" onClick={onExport} disabled={exportDisabled}>
            <Download01Icon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton framed label={hasActiveFilters ? "Filter history, filters active" : "Filter history"} onClick={onFilter}>
            <FilterIcon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton framed label="Refresh history" onClick={onRefresh}>
            <RefreshIcon size={20} aria-hidden="true" />
          </IconButton>
        </>
      }
    />
  );
}
