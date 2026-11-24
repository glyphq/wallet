import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { ApprovalField } from "@/components/request/approval-field";
import { ActionFooter, SheetLayout } from "./sheet-layout";

export type CopyStatus = "idle" | "success" | "error";

/** Shared terminal page for completed, expired, and invalid requests. */
export function RequestTerminalView({
  title,
  detailLabel,
  detail,
  description,
  accessory,
  technical,
  primaryLabel,
  primaryIcon,
  onPrimary,
}: {
  title: string;
  detailLabel?: string;
  detail?: ReactNode;
  description?: ReactNode;
  accessory?: ReactNode;
  technical?: ReactNode;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  onPrimary: () => void;
}) {
  return (
    <SheetLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: 0 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, lineHeight: "var(--leading-tight)", letterSpacing: "-0.025em", fontWeight: 600, color: "var(--color-text-primary)" }}>
          {title}
        </h1>

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
        {technical}

        <ActionFooter>
          <Button onClick={onPrimary} style={{ flex: 1 }}>
            {primaryIcon}
            {primaryLabel}
          </Button>
        </ActionFooter>
      </div>
    </SheetLayout>
  );
}
