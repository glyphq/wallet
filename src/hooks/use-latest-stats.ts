import { useQuery } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { isGlobalHttpsUrl } from "@/lib/url-security";

interface LatestStats {
  price: number;
  marketCap: number;
  circulatingSupply: string;
  activeAddresses: number;
  epoch: number;
  currentTick: number;
}

function buildStatsUrl(liveApiUrl: string): string {
  const base = new URL(liveApiUrl);
  return new URL("/v1/latest-stats", base).toString();
}

async function fetchLatestStats(url: string): Promise<LatestStats> {
  if (!isGlobalHttpsUrl(url)) throw new Error("stats URL is not an allowed HTTPS endpoint");
  const res = await fetch(url);
  if (!res.ok) throw new Error("stats fetch failed");
  const json = (await res.json()) as { data: LatestStats };
  return json.data;
}

export function useLatestStats() {
  const liveApiUrl = usePersistedStore((s) => s.settings.network.liveApiUrl);
  const customPriceFeedUrl = usePersistedStore((s) => s.settings.customPriceFeedUrl);
  const pollingIntervalMs = usePollingIntervalMs();
  const url = customPriceFeedUrl || buildStatsUrl(liveApiUrl);
  return useQuery({
    queryKey: ["latest-stats", url],
    queryFn: () => fetchLatestStats(url),
    staleTime: 60_000,
    retry: 1,
    refetchInterval: Math.max(15_000, pollingIntervalMs),
    refetchIntervalInBackground: true,
  });
}
