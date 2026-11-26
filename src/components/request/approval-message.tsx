import { previewText } from "./request-format";
import { ApprovalDisclosure, ApprovalField } from "./approval-field";

/** Message/data block shared by signing and verification approvals. */
export function ApprovalMessage({
  title,
  message,
  data,
  dataByteCount,
}: {
  title: string;
  message: string;
  data?: string;
  dataByteCount: number | null;
}) {
  if (data) {
    return (
      <ApprovalDisclosure label={title}>
        <ApprovalField label="Payload">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)" }}>
            {dataByteCount === null ? "Invalid base64" : `${dataByteCount.toLocaleString()} bytes`}
          </span>
        </ApprovalField>
        {message ? (
          <ApprovalField label="Label">
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-primary)" }}>
              {previewText(message, 160)}
            </span>
          </ApprovalField>
        ) : null}
        <div
          style={{
            maxHeight: 128,
            overflowY: "auto",
            padding: "var(--space-3)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-sharp)",
            background: "var(--color-bg-inset)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
            overflowWrap: "anywhere",
          }}
        >
          {data}
        </div>
      </ApprovalDisclosure>
    );
  }

  return (
    <ApprovalField label={title}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-primary)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {message}
      </span>
    </ApprovalField>
  );
}
