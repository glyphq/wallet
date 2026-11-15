import { z } from "zod";
import { normalizedGlobalHttpsOrigin } from "@/lib/url-security";
import { REQUEST_PROTOCOL_V2, type GlyphNetworkBinding } from "@/lib/jcs";
import { glyphRequestSchema } from "./request-schema-requests";
import { isAllowedCallbackUrl } from "./request-schema-url";

const OFFICIAL_RELAY_ORIGIN = "https://relay.glyphq.org";

const networkBindingSchema = z.object({
  id: z.union([
    z.literal("qubic:mainnet"),
    z.literal("qubic:testnet"),
    z.string().regex(/^qubic:custom:sha256:[A-Za-z0-9_-]{43}$/),
  ]),
}) as z.ZodType<GlyphNetworkBinding>;

function isOfficialRelayCallback(value: string): boolean {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/v2\/callback\/([A-Za-z0-9_-]{22,128})\/(c_[A-Za-z0-9_-]{22,126})$/);
    return url.origin === OFFICIAL_RELAY_ORIGIN && !url.search && !url.hash && Boolean(match);
  } catch {
    return false;
  }
}

export const glyphEnvelopeSchema = z.object({
  protocol: z.literal(REQUEST_PROTOCOL_V2),
  request: glyphRequestSchema,
  callback: z.union([z.string(), z.null()]),
  redirect_uri: z.union([z.string(), z.null()]),
  network: networkBindingSchema,
  request_hash: z.string().regex(/^sha256:[A-Za-z0-9_-]{43}$/),
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

export type GlyphEnvelope = z.infer<typeof glyphEnvelopeSchema>;
