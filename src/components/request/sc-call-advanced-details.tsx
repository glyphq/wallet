import { RequestDetailRow, RequestDisclosure, RequestSectionTitle, RequestTechnicalBlock } from "./request-primitives";

/** Collapsible raw payload and target tick details for contract calls. */
export function ScCallAdvancedDetails({
  payloadHex,
  payloadByteCount,
  targetTick,
}: {
  payloadHex: string | null;
  payloadByteCount: number;
  targetTick: number | null;
}) {
  return (
    <RequestDisclosure label="Advanced details">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <RequestDetailRow label="Target tick" value={targetTick ? String(targetTick) : "—"} />
        {payloadHex !== null && (
          <div>
            <RequestSectionTitle>Payload · {payloadByteCount.toLocaleString()}B</RequestSectionTitle>
            <div style={{ marginTop: "var(--space-2)" }}>
              <RequestTechnicalBlock maxHeight={160}>{payloadHex}</RequestTechnicalBlock>
            </div>
          </div>
        )}
      </div>
    </RequestDisclosure>
  );
}
