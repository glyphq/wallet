import { activeNetworkBinding } from "@/lib/network-binding";
import { parseGlyphEnvelopeAsync } from "@/lib/request-schema";

type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export async function acceptDeepLinkPayloadAfterNetworkMatch(input: {
  payload: string;
  networkSetting: Parameters<typeof activeNetworkBinding>[0];
  invokeNative: NativeInvoke;
}): Promise<{ accepted: boolean; shouldRetainPending: boolean }> {
  const network = await activeNetworkBinding(input.networkSetting);
  const parsed = await parseGlyphEnvelopeAsync(input.payload, network);
  if (!parsed.envelope) return { accepted: false, shouldRetainPending: true };
  const fresh = await input.invokeNative<boolean>("accept_pending_request", { payload: input.payload, activeNetworkId: network.id });
  // The native command removes only this payload when it is still the queue
  // head. This prevents a delayed handler from clearing a later request.
  await input.invokeNative<boolean>("clear_pending_request", { payload: input.payload }).catch(() => false);
  return { accepted: fresh, shouldRetainPending: false };
}
