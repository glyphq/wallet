import { DEFAULT_ARCHIVE_URL, DEFAULT_LIVE_URL, normalizeRpcUrl } from "@/lib/rpc";
import type { NetworkConfig } from "@/store/persisted-types";

export type NetworkPresetId = NetworkConfig["name"];

export interface NetworkPreset {
  id: NetworkPresetId;
  label: string;
  liveApiUrl: string | null;
  queryApiUrl: string | null;
}

export const NETWORK_PRESETS: readonly NetworkPreset[] = [
  {
    id: "mainnet",
    label: "Mainnet",
    liveApiUrl: DEFAULT_LIVE_URL,
    queryApiUrl: DEFAULT_ARCHIVE_URL,
  },
  {
    id: "testnet",
    label: "Testnet",
    liveApiUrl: null,
    queryApiUrl: null,
  },
  {
    id: "custom",
    label: "Custom",
    liveApiUrl: null,
    queryApiUrl: null,
  },
] as const;

export function identifyNetworkPreset(liveApiUrl: string, queryApiUrl: string, selected: NetworkPresetId): NetworkPresetId {
  const live = normalizeRpcUrl(liveApiUrl.trim());
  const archive = normalizeRpcUrl(queryApiUrl.trim());
  if (live === DEFAULT_LIVE_URL && archive === DEFAULT_ARCHIVE_URL) return "mainnet";
  return selected === "testnet" ? "testnet" : "custom";
}
