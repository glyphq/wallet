import { previewText } from "./request-format";
import { RequestDetailRow, RequestDisclosure, RequestSectionTitle, RequestTechnicalBlock } from "./request-primitives";

/**
 * Review block shared by sign-message and verify-message previews.
 * Renders inline text for plain messages and payload metadata plus a base64 disclosure for binary data.
 */
export function RequestMessageContent({
  title,
  data,
  message,
  dataByteCount,
  plainTextMaxHeight,
}: {
  title: string;
  data?: string;
  message: string;
  dataByteCount: number | null;
  /** Max height for the plain-text block; omitted uses the technical block default. */
  plainTextMaxHeight?: number;
}) {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-2)" }}>
        <RequestSectionTitle>{title}</RequestSectionTitle>
      </div>
      {data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <RequestDetailRow
            label="Payload"
            value={dataByteCount === null ? "Invalid base64" : `${dataByteCount.toLocaleString()} bytes`}
            valueColor={dataByteCount === null ? "var(--color-status-error)" : undefined}
          />
          {message && <RequestDetailRow label="Label" value={previewText(message, 160)} />}
          <RequestDisclosure label={`Show base64 data${dataByteCount === null ? "" : ` · ${dataByteCount.toLocaleString()}B`}`}>
            <RequestTechnicalBlock maxHeight={160}>{data}</RequestTechnicalBlock>
          </RequestDisclosure>
        </div>
      ) : (
        <RequestTechnicalBlock maxHeight={plainTextMaxHeight}>{previewText(message)}</RequestTechnicalBlock>
      )}
    </div>
  );
}
