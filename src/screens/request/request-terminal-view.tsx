import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { ScreenHeader } from "@/components/screen-header";
import { Tag, type TagVariant } from "@/components/tag";
import { ApprovalField } from "@/components/request/approval-field";
import { ActionFooter, SheetLayout } from "./sheet-layout";

export type CopyStatus = "idle" | "success" | "error";

/** Shared terminal page for completed, expired, and invalid requests. */
export function RequestTerminalView({
  title,
  tag,
  tone,
  detailLabel,
  detail,
  description,
  accessory,
  primaryLabel,
  onPrimary,
}: {
  title: string;
  tag: string;
  tone: TagVariant;
  detailLabel?: string;
  detail?: ReactNode;
  description?: ReactNode;
  accessory?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
}) {
  return (
    <SheetLayout statusBar={<ScreenHeader title={title} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: 0 }}>
        <div>
          <Tag variant={tone}>{tag}</Tag>
        </div>

        {detailLabel && detail !== undefined ? (
          <ApprovalField label={detailLabel}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", lineHeight: "var(--leading-body)", letterSpacing: "0.03em", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
              {detail}
            </span>
          </ApprovalField>
        ) : null}

        {description ? (
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
            {description}
          </p>
        ) : null}

        {accessory}

        <ActionFooter>
          <Button onClick={onPrimary} style={{ flex: 1 }}>{primaryLabel}</Button>
        </ActionFooter>
      </div>
    </SheetLayout>
  );
}
