import { z } from "zod";
import { CONTRACT_NAMES, CONTRACT_PROCEDURE_NAMES } from "@/lib/contracts";
import { truncateIdentity } from "@/lib/crypto";
import { formatQu } from "@/lib/format";
import { isGlobalHttpsUrl, normalizedGlobalHttpsOrigin } from "@/lib/url-security";

export const MAX_REQUEST_CHARS = 128 * 1024;
export const MAX_REQUEST_MESSAGE_CHARS = 64 * 1024;
export const MAX_REQUEST_BINARY_BYTES = 64 * 1024;
const OFFICIAL_RELAY_ORIGIN = "https://relay.glyphq.org";

const MAX_UINT64 = 18_446_744_073_709_551_615n;
const MAX_BASE64_CHARS = Math.ceil(MAX_REQUEST_BINARY_BYTES / 3) * 4;

function isBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

const permissionSchema = z.enum(["transfer", "sc_call", "sign_message"]);

const dappMetaSchema = z.object({
  name: z.string().max(256).optional().default(""),
  origin: z.string().max(2048),
  icon: z.string().max(2048).optional(),
});

const baseRequestSchema = z.object({
  dapp: dappMetaSchema,
  nonce: z.string().min(1).max(256),
  exp: z.number().int().positive().optional(),
});

const amountSchema = z.union([
  z.number().int().safe().nonnegative(),
  z.string().max(20).regex(/^\d+$/, "Amount must be an unsigned integer"),
]).refine((value) => BigInt(value) <= MAX_UINT64, "Amount exceeds the maximum supported value");

const binaryDataSchema = z.string()
  .max(MAX_BASE64_CHARS, "Binary data is too large")
  .refine(isBase64, "Binary data must be valid base64");
const tickOffsetSchema = z.number().int().min(1).max(60);

function isOfficialRelayCallback(value: string): boolean {
  try {
    const url = new URL(value);
    const nonce = url.pathname.match(/^\/v1\/callback\/([A-Za-z0-9_-]{16,128})$/)?.[1];
    return url.origin === OFFICIAL_RELAY_ORIGIN && !url.search && !url.hash && Boolean(nonce);
  } catch {
    return false;
  }
}

export const transferRequestSchema = baseRequestSchema.extend({
  type: z.literal("transfer"),
  to: z.string(),
  amount: amountSchema.refine((value) => BigInt(value) > 0n, "Transfer amount must be positive"),
  from: z.string().optional(),
  tick_offset: tickOffsetSchema.optional(),
});

export const scCallRequestSchema = baseRequestSchema.extend({
  type: z.literal("sc_call"),
  contract_index: z.number().int().min(0).max(1023),
  input_type: z.number().int().min(0).max(65535),
  from: z.string().optional(),
  amount: amountSchema.optional(),
  payload: binaryDataSchema.optional(),
  tick_offset: tickOffsetSchema.optional(),
});

export const signMessageRequestSchema = baseRequestSchema.extend({
  type: z.literal("sign_message"),
  message: z.string().max(MAX_REQUEST_MESSAGE_CHARS),
  from: z.string().optional(),
  data: binaryDataSchema.optional(),
});

export const verifyMessageRequestSchema = baseRequestSchema.extend({
  type: z.literal("verify_message"),
  message: z.string().max(MAX_REQUEST_MESSAGE_CHARS),
  data: binaryDataSchema.optional(),
  signature: binaryDataSchema,
  public_key: binaryDataSchema,
});

export const connectRequestSchema = baseRequestSchema.extend({
  type: z.literal("connect"),
  permissions: z.array(permissionSchema).optional(),
});

export const glyphRequestSchema = z.discriminatedUnion("type", [
  transferRequestSchema,
  scCallRequestSchema,
  signMessageRequestSchema,
  verifyMessageRequestSchema,
  connectRequestSchema,
]);

export const glyphEnvelopeSchema = z.object({
  request: glyphRequestSchema,
  callback: z.union([z.string(), z.null()]).optional().transform((value) => value ?? null),
  redirect_uri: z.union([z.string(), z.null()]).optional().transform((value) => value ?? null),
}).superRefine((envelope, ctx) => {
  const claimedOrigin = normalizedGlobalHttpsOrigin(envelope.request.dapp.origin);
  if (!claimedOrigin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dApp origin must be HTTPS",
      path: ["request", "dapp", "origin"],
    });
  }

  if (envelope.callback && !isAllowedCallbackUrl(envelope.callback)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Callback URL must use HTTPS",
      path: ["callback"],
    });
  }
  if (envelope.callback && claimedOrigin
    && normalizedGlobalHttpsOrigin(envelope.callback) !== claimedOrigin
    && !isOfficialRelayCallback(envelope.callback)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Callback origin must match dApp origin", path: ["callback"] });
  }

  if (envelope.redirect_uri && !isAllowedCallbackUrl(envelope.redirect_uri)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "redirect_uri must use HTTPS", path: ["redirect_uri"] });
  }
  if (envelope.redirect_uri && claimedOrigin && normalizedGlobalHttpsOrigin(envelope.redirect_uri) !== claimedOrigin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "redirect_uri origin must match dApp origin", path: ["redirect_uri"] });
  }

  if (envelope.request.exp && Math.floor(Date.now() / 1000) > envelope.request.exp) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Request expired",
      path: ["request", "exp"],
    });
  }
});

// ── Callback response types ────────────────────────────────────────────────────

export interface GlyphSignedTransferCallback {
  status: "signed";
  type: "transfer" | "sc_call";
  nonce: string;
  identity: string;
  tx_hash: string;
  target_tick: number;
}

export interface GlyphSignedMessageCallback {
  status: "signed";
  type: "sign_message";
  nonce: string;
  identity: string;
  signature: string;
  public_key: string;
}

export interface GlyphConnectedCallback {
  status: "connected";
  type: "connect";
  nonce: string;
  identity: string;
  permissions: GlyphPermission[];
}

export interface GlyphVerifiedCallback {
  status: "verified";
  type: "verify_message";
  nonce: string;
  valid: boolean;
  identity: string;
}

export interface GlyphRejectedCallback {
  status: "rejected";
  type: GlyphRequest["type"];
  nonce: string;
  reason: "user_rejected";
}

export type GlyphCallbackResponse =
  | GlyphSignedTransferCallback
  | GlyphSignedMessageCallback
  | GlyphConnectedCallback
  | GlyphVerifiedCallback
  | GlyphRejectedCallback;

export type DappMeta = z.infer<typeof dappMetaSchema>;
export type TransferRequest = z.infer<typeof transferRequestSchema>;
export type ScCallRequest = z.infer<typeof scCallRequestSchema>;
export type SignMessageRequest = z.infer<typeof signMessageRequestSchema>;
export type VerifyMessageRequest = z.infer<typeof verifyMessageRequestSchema>;
export type ConnectRequest = z.infer<typeof connectRequestSchema>;
export type GlyphRequest = z.infer<typeof glyphRequestSchema>;
export type GlyphEnvelope = z.infer<typeof glyphEnvelopeSchema>;
export type GlyphPermission = z.infer<typeof permissionSchema>;

export type ParsedEnvelopeResult =
  | { envelope: GlyphEnvelope; error: null }
  | { envelope: null; error: string };

export const REQUEST_TYPE_LABEL: Record<GlyphRequest["type"], string> = {
  transfer: "Send QU",
  sc_call: "Contract call",
  sign_message: "Sign message",
  verify_message: "Verify signature",
  connect: "Connect",
};

export function isAllowedCallbackUrl(value: string): boolean {
  return isGlobalHttpsUrl(value);
}

export function parseGlyphEnvelope(raw: string | null): ParsedEnvelopeResult {
  if (!raw) return { envelope: null, error: "No pending request" };
  if (raw.length > MAX_REQUEST_CHARS) return { envelope: null, error: "Request is too large" };
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = glyphEnvelopeSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return { envelope: null, error: firstIssue?.message ?? "Invalid request format" };
    }
    return { envelope: result.data, error: null };
  } catch {
    return { envelope: null, error: "Invalid request format" };
  }
}

function parseQuAmount(value: unknown): bigint | null {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {
    return null;
  }
  return null;
}

export function buildRequestNotification(input: GlyphRequest): { title: string; body: string } | null {
  switch (input.type) {
    case "transfer": {
      const amount = parseQuAmount(input.amount);
      const to = truncateIdentity(input.to);
      return {
        title: "Request Waiting For Review",
        body: amount !== null ? `Transfer ${formatQu(amount)} QU to ${to}.` : `Transfer QU to ${to}.`,
      };
    }
    case "sc_call": {
      const amount = parseQuAmount(input.amount);
      const contractName = CONTRACT_NAMES[input.contract_index] ?? `Contract #${input.contract_index}`;
      const procedureName = CONTRACT_PROCEDURE_NAMES[`${input.contract_index}:${input.input_type}`] ?? null;
      const label = procedureName ? `${contractName} · ${procedureName}` : contractName;
      return {
        title: "Request Waiting For Review",
        body: amount !== null && amount > 0n ? `Contract call: ${label} for ${formatQu(amount)} QU.` : `Contract call: ${label}.`,
      };
    }
    case "sign_message":
      return { title: "Request Waiting For Review", body: "Message signing request received." };
    case "verify_message":
      return { title: "Request Waiting For Review", body: "Signature verification request received." };
    case "connect":
      return { title: "Request Waiting For Review", body: "Connection request received." };
    default:
      return null;
  }
}
