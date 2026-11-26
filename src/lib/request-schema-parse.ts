import { requestHashV2, type GlyphNetworkBinding } from "@/lib/jcs";
import type { GlyphEnvelope } from "./request-schema-envelope";
import { glyphEnvelopeSchema } from "./request-schema-envelope";
import { MAX_REQUEST_CHARS } from "./request-schema-limits";

export type ParsedEnvelopeResult =
  | { envelope: GlyphEnvelope; error: null }
  | { envelope: null; error: string };

export type ParsedEnvelopeAsyncResult =
  | { envelope: GlyphEnvelope; error: null }
  | { envelope: null; error: string };

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

async function verifyGlyphEnvelope(envelope: GlyphEnvelope, activeNetwork?: GlyphNetworkBinding): Promise<string | null> {
  const expectedHash = await requestHashV2({
    protocol: envelope.protocol,
    request: envelope.request,
    callback: envelope.callback,
    redirect_uri: envelope.redirect_uri,
    network: envelope.network,
  });
  if (expectedHash !== envelope.request_hash) return "Request hash mismatch";
  if (activeNetwork && activeNetwork.id !== envelope.network.id) return "Request network does not match active wallet network";
  return null;
}

export async function parseGlyphEnvelopeAsync(raw: string | null, activeNetwork?: GlyphNetworkBinding): Promise<ParsedEnvelopeAsyncResult> {
  const parsed = parseGlyphEnvelope(raw);
  if (!parsed.envelope) return parsed;
  const error = await verifyGlyphEnvelope(parsed.envelope, activeNetwork);
  if (error) return { envelope: null, error };
  return parsed;
}
