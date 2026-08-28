import { activeNetworkBinding } from "@/lib/network-binding";
import { parseGlyphEnvelopeAsync } from "@/lib/request-schema";
import type { GlyphEnvelope } from "@/lib/request-schema";

import type { PendingRequestAcceptance } from "@/lib/pending-request-queue";

type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export async function requireActiveNetworkEnvelope(input: {
  payload: string;
  networkSetting: Parameters<typeof activeNetworkBinding>[0];
}): Promise<GlyphEnvelope> {
  const binding = await activeNetworkBinding(input.networkSetting);
  const parsed = await parseGlyphEnvelopeAsync(input.payload, binding);
  if (!parsed.envelope) {
    throw new Error(parsed.error ?? "This request is bound to a different network. Switch networks and retry.");
  }
  return parsed.envelope;
}

export async function acceptDeepLinkPayloadAfterNetworkMatch(input: {
  payload: string;
  networkSetting: Parameters<typeof activeNetworkBinding>[0];
  invokeNative: NativeInvoke;
}): Promise<PendingRequestAcceptance> {
  const network = await activeNetworkBinding(input.networkSetting);
  const parsed = await parseGlyphEnvelopeAsync(input.payload, network);
  if (!parsed.envelope) {
    const structurallyValid = await parseGlyphEnvelopeAsync(input.payload);
    if (!structurallyValid.envelope) {
      const cleared = await input.invokeNative<boolean>("clear_pending_request", { payload: input.payload }).catch(() => false);
      return { accepted: false, shouldRetainPending: !cleared };
    }
    const cleared = await input.invokeNative<boolean>("clear_pending_request", { payload: input.payload }).catch(() => false);
    return {
      accepted: false,
      shouldRetainPending: !cleared,
      deferredForNetworkSwitch: cleared,
    };
  }
  const fresh = await input.invokeNative<boolean>("accept_pending_request", { payload: input.payload, activeNetworkId: network.id });
  // The native command removes only this payload when it is still the queue
  // head. This prevents a delayed handler from clearing a later request.
  await input.invokeNative<boolean>("clear_pending_request", { payload: input.payload }).catch(() => false);
  return { accepted: fresh, shouldRetainPending: false };
}
