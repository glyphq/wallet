import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersistedStore } from "@/store/persisted";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";

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

async function fetchLatestStats(liveApiUrl: string): Promise<LatestStats> {
  const res = await fetch(buildStatsUrl(liveApiUrl));
  if (!res.ok) throw new Error("stats fetch failed");
  const json = (await res.json()) as { data: LatestStats };
  return json.data;
}

export function useLatestStats() {
  const liveApiUrl = usePersistedStore((s) => s.settings.network.liveApiUrl);
  const pollingIntervalMs = usePollingIntervalMs();
  const addPriceSnapshot = usePersistedStore((s) => s.addPriceSnapshot);
  const query = useQuery({
    queryKey: ["latest-stats", liveApiUrl],
    queryFn: () => fetchLatestStats(liveApiUrl),
    staleTime: 60_000,
    retry: 1,
    refetchInterval: Math.max(15_000, pollingIntervalMs),
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!query.data || !Number.isFinite(query.data.price)) return;
    addPriceSnapshot({ timestamp: Date.now(), priceUsd: query.data.price });
  }, [addPriceSnapshot, query.data]);

  return query;
}
