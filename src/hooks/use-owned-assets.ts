import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";

export interface OwnedAssetItem {
  name: string;
  numberOfUnits: string;
  issuanceIndex: number;
  managingContractIndex: number;
  issuerIdentity: string;
  numberOfDecimalPlaces: number;
}

/** Fetches assets owned by the given identity via the live RPC. */
export function useOwnedAssets(identity: string | null | undefined) {
  const pollingIntervalMs = usePollingIntervalMs();
  const rpcIdentity = useRpcCacheIdentity("live");

  return useQuery({
    queryKey: ["owned-assets", rpcIdentity, identity],
    queryFn: async () => {
      const result = await getRpcClient().live.getOwnedAssets(identity!);
      if (!result.ok) throw result.error;

      const items: OwnedAssetItem[] = [];
      for (const asset of result.value ?? []) {
        const d = asset.data;
        const issued = d?.issuedAsset;
        if (!d || !issued?.name) continue;
        items.push({
          name: issued.name,
          numberOfUnits: d.numberOfUnits ?? "0",
          issuanceIndex: d.issuanceIndex ?? 0,
          managingContractIndex: d.managingContractIndex ?? 0,
          issuerIdentity: issued.issuerIdentity ?? "",
          numberOfDecimalPlaces: issued.numberOfDecimalPlaces ?? 0,
        });
      }
      return items;
    },
    enabled: !!identity,
    staleTime: Math.min(30_000, pollingIntervalMs * 3),
    refetchInterval: Math.max(30_000, pollingIntervalMs * 3),
    refetchIntervalInBackground: true,
  });
}
