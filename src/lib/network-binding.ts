import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL, normalizeRpcUrl } from "@/lib/rpc";
import { jcsSha256Base64Url, type GlyphNetworkBinding } from "@/lib/jcs";
import type { NetworkConfig } from "@/store/persisted";

export async function activeNetworkBinding(network: NetworkConfig): Promise<GlyphNetworkBinding> {
  if (network.name === "mainnet") return { id: "qubic:mainnet" };
  if (network.name === "testnet") return { id: "qubic:testnet" };
  const rpc = {
    liveApiUrl: normalizeRpcUrl(network.liveApiUrl) ?? DEFAULT_LIVE_URL,
    queryApiUrl: normalizeRpcUrl(network.queryApiUrl) ?? DEFAULT_ARCHIVE_URL,
  };
  return { id: `qubic:custom:sha256:${await jcsSha256Base64Url(rpc)}` };
}

export function networkFingerprint(network: GlyphNetworkBinding): string {
  if (network.id === "qubic:mainnet") return "mainnet";
  if (network.id === "qubic:testnet") return "testnet";
  return `custom ${network.id.slice(-12)}`;
}
