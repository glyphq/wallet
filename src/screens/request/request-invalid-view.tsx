import { Button } from "@/components/button";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { useReviewMode } from "./review-mode";
import { ActionFooter, SheetLayout, StatusLine } from "./sheet-layout";

/**
 * Shown when the queued request payload fails envelope parsing.
 * The header back button only navigates; the footer button also drops the queued request.
 */
export function RequestInvalidView({
  error,
  onBack,
  onBackToApp,
}: {
  error: string | null;
  onBack: () => void;
  onBackToApp: () => void;
}) {
  const { approvalWindow } = useReviewMode();
  return (
    <SheetLayout statusBar={<ScreenHeader title="Request" onBack={approvalWindow ? undefined : onBack} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1, minHeight: "100%" }}>
        <Tag variant="error">Invalid request</Tag>
        <StatusLine tone="error">{error}</StatusLine>
        <ActionFooter>
          <Button variant="secondary" shape="sharp" onClick={onBackToApp} style={{ flex: 1 }}>Back to app</Button>
        </ActionFooter>
      </div>
    </SheetLayout>
  );
}
