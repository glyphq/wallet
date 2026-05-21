import { useQuery } from "@tanstack/react-query";

interface LatestStats {
  price: number;
  marketCap: number;
  circulatingSupply: string;
  activeAddresses: number;
  epoch: number;
  currentTick: number;
}

async function fetchLatestStats(): Promise<LatestStats> {
  const res = await fetch("https://rpc.qubic.org/v1/latest-stats");
  if (!res.ok) throw new Error("stats fetch failed");
  const json = (await res.json()) as { data: LatestStats };
  return json.data;
}

export function useLatestStats() {
  return useQuery({
    queryKey: ["latest-stats"],
    queryFn: fetchLatestStats,
    staleTime: 60_000,
    retry: 1,
  });
}
