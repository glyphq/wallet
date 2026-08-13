import { describe, expect, test } from "bun:test";
import { acceptDeepLinkPayloadAfterNetworkMatch } from "@/lib/deep-link-acceptance";
import { REQUEST_PROTOCOL_V2, requestHashV2, type GlyphNetworkBinding } from "@/lib/jcs";
import type { NetworkConfig } from "@/store/persisted";

const mainnet: NetworkConfig = { name: "mainnet", liveApiUrl: "", queryApiUrl: "" };
const testnet: NetworkConfig = { name: "testnet", liveApiUrl: "", queryApiUrl: "" };

async function makePayload(network: GlyphNetworkBinding): Promise<string> {
  const request = {
    type: "connect" as const,
    dapp: { name: "Demo", origin: "https://demo.app" },
    nonce: "replay-network-regression",
    exp: Math.floor(Date.now() / 1000) + 3600,
    permissions: ["transfer" as const],
  };
  const envelope = {
    protocol: REQUEST_PROTOCOL_V2,
    request,
    callback: "https://relay.glyphq.org/v2/callback/session_1234567890abcdef/c_callbackCapability1234567890ab",
    redirect_uri: null,
    network,
    request_hash: "",
  };
  envelope.request_hash = await requestHashV2({
    protocol: envelope.protocol,
    request: envelope.request,
    callback: envelope.callback,
    redirect_uri: envelope.redirect_uri,
    network: envelope.network,
  });
  return JSON.stringify(envelope);
}

describe("deep link acceptance replay boundary", () => {
  test("does not burn replay state for a valid request on the wrong network", async () => {
    const payload = await makePayload({ id: "qubic:testnet" });
    const commands: string[] = [];
    const clearPayloads: unknown[] = [];
    let consumed = false;
    const invokeNative = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
      commands.push(command);
      if (command === "clear_pending_request") clearPayloads.push(args?.payload);
      if (command === "accept_pending_request") {
        expect(args).toMatchObject({ activeNetworkId: "qubic:testnet" });
        if (consumed) return false as T;
        consumed = true;
        return true as T;
      }
      return undefined as T;
    };

    await expect(acceptDeepLinkPayloadAfterNetworkMatch({ payload, networkSetting: mainnet, invokeNative })).resolves.toEqual({
      accepted: false,
      shouldRetainPending: true,
    });
    expect(commands).toEqual([]);
    expect(consumed).toBe(false);

    await expect(acceptDeepLinkPayloadAfterNetworkMatch({ payload, networkSetting: testnet, invokeNative })).resolves.toEqual({
      accepted: true,
      shouldRetainPending: false,
    });
    await expect(acceptDeepLinkPayloadAfterNetworkMatch({ payload, networkSetting: testnet, invokeNative })).resolves.toEqual({
      accepted: false,
      shouldRetainPending: false,
    });
    expect(commands).toEqual(["accept_pending_request", "clear_pending_request", "accept_pending_request", "clear_pending_request"]);
    expect(clearPayloads).toEqual([payload, payload]);
  });
});
