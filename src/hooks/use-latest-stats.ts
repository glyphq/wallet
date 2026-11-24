import { useQuery } from "@tanstack/react-query";
import { getMarket, getNetworkIndex } from "@/lib/api/generated";
import { usePersistedStore } from "@/store/persisted";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { isGlobalHttpsUrl, isTrustedPriceFeedUrl } from "@/lib/url-security";

interface LatestStats {
  price: number;
  marketCap: number;
  circulatingSupply: string;
  activeAddresses: number;
  epoch: number;
  currentTick: number;
}

async function fetchLatestStats(url: string): Promise<LatestStats> {
  if (!isGlobalHttpsUrl(url)) throw new Error("stats URL is not an allowed HTTPS endpoint");
  const res = await fetch(url);
  if (!res.ok) throw new Error("stats fetch failed");
  const json = (await res.json()) as { data: LatestStats };
  return json.data;
}

async function fetchApiStats(): Promise<LatestStats> {
  const [market, index] = await Promise.all([
    getMarket({ throwOnError: true }),
    getNetworkIndex({ throwOnError: true }),
  ]);
  const snapshot = market.data.data;
  const network = index.data.data;
  return {
    price: snapshot.price_usd,
    marketCap: snapshot.market_cap_usd ?? 0,
    circulatingSupply: "",
    activeAddresses: network?.identities ?? 0,
    epoch: network?.head?.epoch ?? 0,
    currentTick: network?.head?.tick ?? 0,
  };
}

export function useLatestStats() {
  const customPriceFeedUrl = usePersistedStore((s) => s.settings.customPriceFeedUrl);
  const pollingIntervalMs = usePollingIntervalMs();
  const customFeedAllowed =
    import.meta.env.DEV || isTrustedPriceFeedUrl(customPriceFeedUrl);
  const customUrl = customPriceFeedUrl && customFeedAllowed ? customPriceFeedUrl : null;
  return useQuery({
    queryKey: ["latest-stats", customUrl],
    queryFn: () => (customUrl ? fetchLatestStats(customUrl) : fetchApiStats()),
    staleTime: 60_000,
    retry: 1,
    refetchInterval: Math.max(15_000, pollingIntervalMs),
    refetchIntervalInBackground: true,
  });
}
