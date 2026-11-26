import type { GlyphEnvelope } from "@/lib/request-schema";
import type { RequestOrchestrationDeps } from "./request-orchestration-types";

export function recordApprovedRequestAudit(
  deps: RequestOrchestrationDeps,
  input: { envelope: GlyphEnvelope; title: string; detail: string }
) {
  deps.recordAuditEvent({
    kind: "request_approved",
    status: "success",
    title: input.title,
    detail: input.detail,
  });
}

export function recordRejectedRequestAudit(
  deps: RequestOrchestrationDeps,
  envelope: GlyphEnvelope
) {
  deps.recordAuditEvent({
    kind: "request_rejected",
    status: "info",
    title: "Request rejected",
    detail: `${envelope.request.type} from ${envelope.request.dapp.origin}`,
  });
}
