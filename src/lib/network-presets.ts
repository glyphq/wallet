import {
  LOCAL_TESTNET_LIVE_API_URL,
  LOCAL_TESTNET_QUERY_API_URL,
  MAINNET_NETWORK_CONFIG,
  tryResolveNetworkConfig,
  type NetworkKind,
} from "@/lib/network-config";

export type NetworkPresetId = NetworkKind;
export type ConfiguredNetworkPresetId = NetworkPresetId;

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
    liveApiUrl: MAINNET_NETWORK_CONFIG.liveApiUrl,
    queryApiUrl: MAINNET_NETWORK_CONFIG.queryApiUrl,
  },
  {
    id: "testnet",
    label: "Local testnet",
    liveApiUrl: LOCAL_TESTNET_LIVE_API_URL,
    queryApiUrl: LOCAL_TESTNET_QUERY_API_URL,
  },
  {
    id: "custom",
    label: "Custom",
    liveApiUrl: null,
    queryApiUrl: null,
  },
] as const;

/**
 * Classifies a valid endpoint pair. Invalid/incomplete input is treated as a
 * custom draft for settings-screen compatibility, while canonical resolution
 * remains fail-closed through resolveNetworkConfig.
 */
export function identifyNetworkPreset(
  liveApiUrl: string,
  queryApiUrl: string
): ConfiguredNetworkPresetId {
  return (
    tryResolveNetworkConfig({ liveApiUrl, queryApiUrl })?.name ?? "custom"
  );
}
