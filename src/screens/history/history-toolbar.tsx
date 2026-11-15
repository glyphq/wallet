import { Download01Icon, FilterIcon, RefreshIcon, ChartLineData01Icon } from "@/lib/icons";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellVaultSwitcher } from "@/components/shell-vault-switcher";

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
      leading={<ShellVaultSwitcher />}
      title="History"
      action={
        <>
          <IconButton label="View analytics" onClick={onViewAnalytics}>
            <ChartLineData01Icon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label="Export history" onClick={onExport} disabled={exportDisabled}>
            <Download01Icon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label={hasActiveFilters ? "Filter history, filters active" : "Filter history"} onClick={onFilter}>
            <FilterIcon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label="Refresh history" onClick={onRefresh}>
            <RefreshIcon size={20} aria-hidden="true" />
          </IconButton>
        </>
      }
    />
  );
}
