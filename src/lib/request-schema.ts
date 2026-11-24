import type { GlyphRequest } from "./request-schema-requests";

export {
  MAX_REQUEST_CHARS,
  MAX_REQUEST_CONTRACT_INDEX,
} from "./request-schema-limits";
export { scCallRequestSchema } from "./request-schema-requests";
export type {
  ConnectRequest,
  DappMeta,
  GlyphRequest,
  ScCallRequest,
  SignMessageRequest,
  TransferRequest,
  VerifyMessageRequest,
} from "./request-schema-requests";
export type { GlyphEnvelope } from "./request-schema-envelope";
export type {
  GlyphCallbackResponse,
  GlyphConnectedCallback,
  GlyphRejectedCallback,
  GlyphSignedMessageCallback,
  GlyphSignedTransferCallback,
  GlyphVerifiedCallback,
} from "./request-schema-callbacks";
export {
  parseGlyphEnvelope,
  parseGlyphEnvelopeAsync,
} from "./request-schema-parse";
export type {
  ParsedEnvelopeAsyncResult,
  ParsedEnvelopeResult,
} from "./request-schema-parse";
export { buildRequestNotification } from "./request-schema-notification";

export const REQUEST_TYPE_LABEL: Record<GlyphRequest["type"], string> = {
  transfer: "Send QU",
  sc_call: "Contract call",
  sign_message: "Sign message",
  verify_message: "Verify signature",
  connect: "Connect",
};
