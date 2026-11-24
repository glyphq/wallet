import { useQuery } from "@tanstack/react-query";
import { listWalletAssetsOptions } from "@/lib/api/generated/@tanstack/react-query.gen";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";

export interface OwnedAssetItem {
  name: string;
  numberOfUnits: string;
  issuanceIndex: number;
  managingContractIndex: number;
  issuerIdentity: string;
  numberOfDecimalPlaces: number;
}

/** Fetches assets owned by the given identity via the Glyph API wallet snapshot. */
export function useOwnedAssets(identity: string | null | undefined) {
  const pollingIntervalMs = usePollingIntervalMs();

  return useQuery({
    ...listWalletAssetsOptions({
      path: { identity: identity ?? "" },
      query: { kind: "owned" },
    }),
    select: (response): OwnedAssetItem[] =>
      (response.data?.owned ?? []).map((asset) => ({
        name: asset.name,
        numberOfUnits: String(asset.shares),
        issuanceIndex: asset.universe_index ?? 0,
        managingContractIndex: asset.managing_contract_index ?? 0,
        issuerIdentity: asset.issuer,
        numberOfDecimalPlaces: asset.decimals ?? 0,
      })),
    enabled: !!identity,
    staleTime: Math.min(30_000, pollingIntervalMs * 3),
    refetchInterval: Math.max(30_000, pollingIntervalMs * 3),
    refetchIntervalInBackground: true,
  });
}
