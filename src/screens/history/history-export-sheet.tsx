import { Sheet } from "@/components/sheet";
import { ExportAction } from "./history-ui";

export function HistoryExportSheet({
  open, recordCount, hasMemos, onExport, onExportMemos, onClose,
}: {
  open: boolean;
  recordCount: number;
  hasMemos: boolean;
  onExport: (format: "csv" | "json") => void;
  onExportMemos: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Export history"
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <ExportAction label="CSV" detail={`${recordCount} records`} onClick={() => onExport("csv")} />
        <ExportAction label="JSON" detail={`${recordCount} records`} onClick={() => onExport("json")} />
        {hasMemos && <ExportAction label="Memos" detail="JSON" onClick={onExportMemos} />}
      </div>
    </Sheet>
  );
}
