export interface StatsNetworkConfig {
  name: "mainnet" | "testnet" | "custom";
  liveApiUrl: string;
}

export function buildStatsUrl(liveApiUrl: string): string {
  const base = new URL(liveApiUrl);
  return new URL("/v1/latest-stats", base).toString();
}

export function resolveLatestStatsUrl(
  network: StatsNetworkConfig,
  customPriceFeedUrl: string,
): string | null {
  // Local testnet QU has no real market value. A custom price feed must not
  // accidentally make test funds look equivalent to mainnet funds.
  if (network.name === "testnet") return null;
  return customPriceFeedUrl || buildStatsUrl(network.liveApiUrl);
}
