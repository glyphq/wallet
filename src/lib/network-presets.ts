import { DEFAULT_API_URL, normalizeApiUrl } from "@/lib/api-url";
import type { NetworkConfig } from "@/store/persisted-types";

export type NetworkPresetId = NetworkConfig["name"];
export type ConfiguredNetworkPresetId = Exclude<NetworkPresetId, "testnet">;

export interface NetworkPreset {
  id: NetworkPresetId;
  label: string;
  /** Null means the preset starts blank until the user supplies an API origin. */
  apiUrl: string | null;
}

export const NETWORK_PRESETS: readonly NetworkPreset[] = [
  { id: "mainnet", label: "Mainnet", apiUrl: DEFAULT_API_URL },
  { id: "testnet", label: "Testnet", apiUrl: null },
  { id: "custom", label: "Custom", apiUrl: null },
] as const;

export function identifyNetworkPreset(apiUrl: string): ConfiguredNetworkPresetId {
  return normalizeApiUrl(apiUrl) === DEFAULT_API_URL ? "mainnet" : "custom";
}
