import { ApprovalDisclosure, ApprovalField } from "@/components/request/approval-field";
import type { GlyphEnvelope } from "@/lib/request-schema";
import { REQUEST_TYPE_LABEL } from "@/lib/request-schema";
import type { RequestHistoryItem } from "@/store/persisted";
import { formatDate } from "@/lib/format";

function CodeBlock({ children }: { children: string }) {
  return (
    <div
      style={{
        maxHeight: 160,
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
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <ApprovalField label={label}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)", letterSpacing: "0.03em", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>
        {value}
      </span>
    </ApprovalField>
  );
}

/** Collapsible request metadata shown on terminal pages. */
export function RequestTechnicalDetails(props:
  | { kind: "success"; envelope: GlyphEnvelope | null; callbackStatus: string; requestHistoryId: string | null }
  | { kind: "expired"; item: RequestHistoryItem }
  | { kind: "invalid"; error: string | null; raw: string | null },
) {
  if (props.kind === "invalid") {
    return (
      <ApprovalDisclosure label="Technical details">
        <Row label="Parse error" value={props.error ?? "Unknown request error"} />
        {props.raw ? (
          <ApprovalDisclosure label="Raw request">
            <CodeBlock>{props.raw}</CodeBlock>
          </ApprovalDisclosure>
        ) : null}
      </ApprovalDisclosure>
    );
  }

  if (props.kind === "expired") {
    return (
      <ApprovalDisclosure label="Technical details">
        <Row label="Request type" value={REQUEST_TYPE_LABEL[props.item.type]} />
        <Row label="dApp" value={props.item.dappName} />
        <Row label="Origin" value={props.item.dappOrigin} />
        <Row label="Created" value={formatDate(props.item.createdAt)} />
        <Row label="Callback" value={props.item.callbackUrl ?? "None"} />
        <Row label="Callback status" value={props.item.callbackStatus} />
        <Row label="History ID" value={props.item.id} />
      </ApprovalDisclosure>
    );
  }

  const request = props.envelope?.request;
  return (
    <ApprovalDisclosure label="Technical details">
      {request ? <Row label="Request type" value={REQUEST_TYPE_LABEL[request.type]} /> : null}
      {request ? <Row label="dApp" value={request.dapp.name || "Unknown dApp"} /> : null}
      {request ? <Row label="Origin" value={request.dapp.origin} /> : null}
      {request ? <Row label="Nonce" value={request.nonce} /> : null}
      {props.envelope ? <Row label="Network" value={props.envelope.network.id} /> : null}
      {props.envelope ? <Row label="Request hash" value={props.envelope.request_hash} /> : null}
      {props.envelope ? <Row label="Callback" value={props.envelope.callback ?? "None"} /> : null}
      <Row label="Callback status" value={props.callbackStatus} />
      {props.requestHistoryId ? <Row label="History ID" value={props.requestHistoryId} /> : null}
    </ApprovalDisclosure>
  );
}
