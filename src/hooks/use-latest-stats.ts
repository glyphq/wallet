import { useQuery } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { isGlobalHttpsUrl } from "@/lib/url-security";
import { resolveLatestStatsUrl } from "@/lib/latest-stats-policy";

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

export function useLatestStats() {
  const network = usePersistedStore((s) => s.settings.network);
  const customPriceFeedUrl = usePersistedStore((s) => s.settings.customPriceFeedUrl);
  const pollingIntervalMs = usePollingIntervalMs();
  const url = resolveLatestStatsUrl(network, customPriceFeedUrl);
  return useQuery({
    queryKey: ["latest-stats", url],
    queryFn: () => {
      if (!url) throw new Error("market statistics are disabled on local testnet");
      return fetchLatestStats(url);
    },
    enabled: url !== null,
    staleTime: 60_000,
    retry: 1,
    refetchInterval: Math.max(15_000, pollingIntervalMs),
    refetchIntervalInBackground: true,
  });
}
