import { jcsSha256Base64Url, type GlyphNetworkBinding } from "@/lib/jcs";
import { parsePersistedNetworkConfig, type NetworkConfig } from "@/lib/network-config";

/** Derives a signed-request binding from the canonical, fail-closed network config. */
export async function activeNetworkBinding(network: NetworkConfig): Promise<GlyphNetworkBinding> {
  const canonical = parsePersistedNetworkConfig(network);
  if (canonical.name === "testnet" && canonical.manifestInstanceId === null) {
    throw new Error("Local testnet instance identity is unresolved. Refresh the network manifest before continuing.");
  }
  if (canonical.name === "mainnet") return { id: "qubic:mainnet" };
  if (canonical.name === "testnet") {
    return { id: canonical.scope as `qubic:testnet:local:qubic-local%3A${string}` };
  }
  return { id: `qubic:custom:sha256:${await jcsSha256Base64Url({ scope: canonical.scope })}` };
}

export function networkFingerprint(network: GlyphNetworkBinding): string {
  if (network.id === "qubic:mainnet") return "mainnet";
  if (network.id.startsWith("qubic:testnet:local:")) return `local testnet ${network.id.slice(-12)}`;
  return `custom ${network.id.slice(-12)}`;
}
