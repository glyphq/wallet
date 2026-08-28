import { jcsSha256Base64Url, type GlyphNetworkBinding } from "@/lib/jcs";
import { parsePersistedNetworkConfig, type NetworkConfig } from "@/lib/network-config";

/** Derives a signed-request binding from the canonical, fail-closed network config. */
export async function activeNetworkBinding(network: NetworkConfig): Promise<GlyphNetworkBinding> {
  const canonical = parsePersistedNetworkConfig(network);
  if (canonical.name === "mainnet" || canonical.name === "testnet") {
    return { id: canonical.scope };
  }
  return { id: `qubic:custom:sha256:${await jcsSha256Base64Url({ scope: canonical.scope })}` };
}

export function networkFingerprint(network: GlyphNetworkBinding): string {
  if (network.id === "qubic:mainnet") return "mainnet";
  if (network.id.startsWith("qubic:testnet:local:")) return `local testnet ${network.id.slice(-12)}`;
  return `custom ${network.id.slice(-12)}`;
}
