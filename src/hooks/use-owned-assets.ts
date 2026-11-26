import { useQuery } from "@tanstack/react-query";
import { listWalletAssets } from "@/lib/api/generated";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

export interface OwnedAssetItem {
  name: string;
  numberOfUnits: string;
  issuanceIndex: number;
  managingContractIndex: number;
  issuerIdentity: string;
  numberOfDecimalPlaces: number;
}

/** Fetches assets owned by the given identity; refreshed by identity stream invalidations. */
export function useOwnedAssets(identity: string | null | undefined) {
  const apiIdentity = useApiCacheIdentity();

  return useQuery({
    queryKey: ["owned-assets", apiIdentity, identity ?? ""],
    queryFn: async () => (await listWalletAssets({
      path: { identity: identity! },
      query: { kind: "owned" },
      throwOnError: true,
    })).data,
    select: (response): OwnedAssetItem[] =>
      (response.data?.owned ?? [])
        // A fully transferred ownership record can remain in peer state with
        // zero shares; it is not a wallet asset anymore.
        .filter((asset) => asset.shares > 0)
        .map((asset) => ({
          name: asset.name,
          numberOfUnits: String(asset.shares),
          issuanceIndex: asset.universe_index ?? 0,
          managingContractIndex: asset.managing_contract_index ?? 0,
          issuerIdentity: asset.issuer,
          numberOfDecimalPlaces: asset.decimals ?? 0,
        })),
    enabled: !!identity,
    staleTime: 30_000,
  });
}
