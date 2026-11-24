import { DEFAULT_API_URL, normalizeApiUrl } from "@/lib/api-url";
import { jcsSha256Base64Url, type GlyphNetworkBinding } from "@/lib/jcs";
import type { NetworkConfig } from "@/store/persisted";

export async function activeNetworkBinding(network: NetworkConfig): Promise<GlyphNetworkBinding> {
  if (network.name === "mainnet") return { id: "qubic:mainnet" };
  if (network.name === "testnet") return { id: "qubic:testnet" };
  const api = { apiUrl: normalizeApiUrl(network.apiUrl) ?? DEFAULT_API_URL };
  return { id: `qubic:custom:sha256:${await jcsSha256Base64Url(api)}` };
}
