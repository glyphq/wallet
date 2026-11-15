import { Button } from "@/components/button";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { ActionFooter, DetailBlock, SheetLayout, StatusLine } from "./sheet-layout";

/** Terminal view shown once the request's exp timestamp passes without a decision. */
export function RequestExpiredView({ dappName, onContinue }: { dappName: string; onContinue: () => void }) {
  return (
    <SheetLayout statusBar={<ScreenHeader title="Request expired" onBack={onContinue} backAriaLabel="Continue" />}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: "100%" }}>
        <Tag variant="warning">Expired</Tag>
        <StatusLine tone="warning">This request expired before you made a decision.</StatusLine>
        <DetailBlock label="dApp">{dappName}</DetailBlock>
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Nothing was approved and no callback was sent because the request authorization is no longer valid. The outcome is saved in request history.
        </p>
        <ActionFooter>
          <Button onClick={onContinue} style={{ flex: 1 }}>Continue</Button>
        </ActionFooter>
      </div>
    </SheetLayout>
  );
}
