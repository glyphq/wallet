import { Button } from "@/components/button";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import type { RequestSuccessState } from "@/lib/request-orchestration";
import { ActionFooter, DetailBlock, SheetLayout, StatusLine } from "./sheet-layout";

export type CopyStatus = "idle" | "success" | "error";

function successLabels(success: RequestSuccessState): { detailLabel: string; tagLabel: string } {
  const detailLabel = success.kind === "tx" ? "Transaction hash" : success.kind === "message" ? "Signature" : success.kind === "verify" ? "Result" : "Address";
  const tagLabel = success.kind === "tx" ? "Sent" : success.kind === "message" ? "Signed" : success.kind === "verify" ? (success.detail === "VALID" ? "Valid" : "Invalid") : "Connected";
  return { detailLabel, tagLabel };
}

/** Completion view shown after the queue drains, including callback delivery status. */
export function RequestResultView({
  success,
  copyStatus,
  onCopy,
  onRetry,
  onSave,
  onReturn,
}: {
  success: RequestSuccessState;
  copyStatus: CopyStatus;
  onCopy: (text: string) => void;
  onRetry: () => void;
  onSave: (success: RequestSuccessState) => void;
  onReturn: () => void;
}) {
  const { detailLabel, tagLabel } = successLabels(success);

  return (
    <SheetLayout statusBar={<ScreenHeader title="Request complete" onBack={onReturn} backAriaLabel="Return to app" />}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: "100%" }}>
        <div>
          <Tag variant={success.kind === "verify" && success.detail !== "VALID" ? "error" : "success"}>{tagLabel}</Tag>
        </div>

        <DetailBlock label={detailLabel}>{success.detail}</DetailBlock>

        <div>
          {!success.hasCallback ? (
            <Button
              variant="secondary"
              shape="sharp"
              size="sm"
              style={{ width: "auto" }}
              onClick={() => onCopy(success.callbackBody)}
            >
              {copyStatus === "success" ? "Copied result" : copyStatus === "error" ? "Copy failed" : "Copy result"}
            </Button>
          ) : success.callbackStatus === "pending" ? (
            <StatusLine tone="muted">Sending callback...</StatusLine>
          ) : success.callbackStatus === "ok" ? (
            <StatusLine tone="success">Callback delivered</StatusLine>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <StatusLine tone="error">Callback failed</StatusLine>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <Button variant="secondary" shape="sharp" size="sm" style={{ width: "auto" }} onClick={onRetry}>
                  Retry callback
                </Button>
                <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => onSave(success)}>
                  Save JSON
                </Button>
                <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => onCopy(success.callbackBody)}>
                  {copyStatus === "success" ? "Copied JSON" : copyStatus === "error" ? "Copy failed" : "Copy JSON"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <ActionFooter>
          <Button onClick={onReturn} style={{ flex: 1 }}>Return to app</Button>
        </ActionFooter>
      </div>
    </SheetLayout>
  );
}
