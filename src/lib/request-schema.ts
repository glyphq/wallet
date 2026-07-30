import { z } from "zod";
import { CONTRACT_NAMES, CONTRACT_PROCEDURE_NAMES } from "@/lib/contracts";
import { truncateIdentity } from "@/lib/crypto";
import { formatQu } from "@/lib/format";

const permissionSchema = z.enum(["transfer", "sc_call", "sign_message"]);

const dappMetaSchema = z.object({
  name: z.string().optional().default(""),
  origin: z.string(),
  icon: z.string().optional(),
});

const baseRequestSchema = z.object({
  dapp: dappMetaSchema,
  nonce: z.string(),
  exp: z.number().int().positive().optional(),
});

const amountSchema = z.union([
  z.number().int().safe().nonnegative(),
  z.string().regex(/^\d+$/, "Amount must be an unsigned integer"),
]);

export const transferRequestSchema = baseRequestSchema.extend({
  type: z.literal("transfer"),
  to: z.string(),
  amount: amountSchema.refine((value) => BigInt(value) > 0n, "Transfer amount must be positive"),
  from: z.string().optional(),
  tick_offset: z.number().int().optional(),
});

export const scCallRequestSchema = baseRequestSchema.extend({
  type: z.literal("sc_call"),
  contract_index: z.number().int().min(0).max(1023),
  input_type: z.number().int().min(0).max(65535),
  from: z.string().optional(),
  amount: amountSchema.optional(),
  payload: z.string().optional(),
  tick_offset: z.number().int().optional(),
});

export const signMessageRequestSchema = baseRequestSchema.extend({
  type: z.literal("sign_message"),
  message: z.string(),
  from: z.string().optional(),
  data: z.string().optional(),
});

export const verifyMessageRequestSchema = baseRequestSchema.extend({
  type: z.literal("verify_message"),
  message: z.string(),
  data: z.string().optional(),
  signature: z.string(),
  public_key: z.string(),
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
  const claimedOrigin = normalizedHttpsOrigin(envelope.request.dapp.origin);
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
  if (envelope.callback && claimedOrigin && normalizedHttpsOrigin(envelope.callback) !== claimedOrigin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Callback origin must match dApp origin", path: ["callback"] });
  }

  if (envelope.redirect_uri && !isAllowedCallbackUrl(envelope.redirect_uri)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "redirect_uri must use HTTPS", path: ["redirect_uri"] });
  }
  if (envelope.redirect_uri && claimedOrigin && normalizedHttpsOrigin(envelope.redirect_uri) !== claimedOrigin) {
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
  return normalizedHttpsOrigin(value) !== null;
}

function normalizedHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname || isNonGlobalLiteral(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isNonGlobalLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((part) => part > 255)) return true;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113);
}

export function parseGlyphEnvelope(raw: string | null): ParsedEnvelopeResult {
  if (!raw) return { envelope: null, error: "No pending request" };
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
