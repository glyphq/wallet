import { describe, expect, test } from "bun:test";
import { acceptDeepLinkPayloadAfterNetworkMatch } from "@/lib/deep-link-acceptance";
import { REQUEST_PROTOCOL_V2, requestHashV2, type GlyphNetworkBinding } from "@/lib/jcs";
import { LOCAL_TESTNET_NETWORK_CONFIG, MAINNET_NETWORK_CONFIG } from "@/lib/network-config";

async function makePayload(network: GlyphNetworkBinding): Promise<string> {
  const request = {
    type: "connect" as const,
    dapp: { name: "Demo", origin: "https://demo.app" },
    nonce: "replay-network-regression",
    exp: Math.floor(Date.now() / 1000) + 3600,
    permissions: ["transfer" as const],
  };
  const envelope = {
    protocol: REQUEST_PROTOCOL_V2, request,
    callback: "https://relay.glyphq.org/v2/callback/session_1234567890abcdef/c_callbackCapability1234567890ab",
    redirect_uri: null, network, request_hash: "",
  };
  envelope.request_hash = await requestHashV2({
    protocol: envelope.protocol, request: envelope.request, callback: envelope.callback,
    redirect_uri: envelope.redirect_uri, network: envelope.network,
  });
  return JSON.stringify(envelope);
}

describe("deep link acceptance replay boundary", () => {
  test("defers a wrong-network request without burning replay state, then accepts after switch", async () => {
    const payload = await makePayload({ id: LOCAL_TESTNET_NETWORK_CONFIG.scope });
    const commands: string[] = [];
    let consumed = false;
    const invokeNative = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
      commands.push(command);
      if (command === "clear_pending_request") return true as T;
      if (command === "accept_pending_request") {
        expect(args).toMatchObject({ activeNetworkId: LOCAL_TESTNET_NETWORK_CONFIG.scope });
        if (consumed) return false as T;
        consumed = true;
        return true as T;
      }
      return undefined as T;
    };

    await expect(acceptDeepLinkPayloadAfterNetworkMatch({ payload, networkSetting: MAINNET_NETWORK_CONFIG, invokeNative })).resolves.toEqual({
      accepted: false, shouldRetainPending: false, deferredForNetworkSwitch: true,
    });
    expect(commands).toEqual(["clear_pending_request"]);
    expect(consumed).toBe(false);

    await expect(acceptDeepLinkPayloadAfterNetworkMatch({ payload, networkSetting: LOCAL_TESTNET_NETWORK_CONFIG, invokeNative })).resolves.toEqual({
      accepted: true, shouldRetainPending: false,
    });
  });
});
