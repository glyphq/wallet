import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMarket, getNetworkIndex } from "@/lib/api/generated";
import { subscribeMarketStream } from "@/lib/api/stream-broker";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
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
  const apiIdentity = useApiCacheIdentity();
  const queryClient = useQueryClient();
  const customFeedAllowed =
    import.meta.env.DEV || isTrustedPriceFeedUrl(customPriceFeedUrl);
  const customUrl = customPriceFeedUrl && customFeedAllowed ? customPriceFeedUrl : null;
  const queryKey = useMemo(
    () => ["latest-stats", apiIdentity, customUrl],
    [apiIdentity, customUrl],
  );

  useEffect(() => {
    if (customUrl) return;
    const update = (patch: Partial<LatestStats>) => {
      queryClient.setQueryData<LatestStats>(queryKey, (previous) =>
        previous ? { ...previous, ...patch } : previous,
      );
    };
    return subscribeMarketStream(apiIdentity, {
      onMarket: (market) => update({
        price: market.price_usd,
        marketCap: market.market_cap_usd ?? 0,
      }),
      onPrice: (price) => {
        if (price.price_usdt !== undefined) update({ price: price.price_usdt });
      },
    });
  }, [apiIdentity, customUrl, queryClient, queryKey]);

  return useQuery({
    queryKey,
    queryFn: () => (customUrl ? fetchLatestStats(customUrl) : fetchApiStats()),
    staleTime: 60_000,
    retry: 1,
    refetchInterval: customUrl ? Math.max(15_000, pollingIntervalMs) : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
