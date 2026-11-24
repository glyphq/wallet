import { useQuery } from "@tanstack/react-query";
import { getAsset } from "@/lib/api/generated";
import {
  fetchMsvaultDetail,
  fetchMsvaultList,
  getMsvaultFees,
  getMsvaultManagedAssetBalance,
} from "@/lib/api/msvault";
import { decodeAssetName, type MsvaultAssetMeta, type MsvaultAssetRef } from "@/lib/msvault";
import { qk } from "@/lib/query-keys";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";

export function useMsvaultFees() {
  const apiIdentity = useApiCacheIdentity();

  return useQuery({
    queryKey: qk.msvaultFees(apiIdentity),
    queryFn: getMsvaultFees,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMsvaultList(identity: string | null | undefined) {
  const apiIdentity = useApiCacheIdentity();

  return useQuery({
    queryKey: qk.msvaultVaults(apiIdentity, identity ?? ""),
    queryFn: () => fetchMsvaultList(identity!),
    enabled: !!identity,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useMsvaultDetail(vaultId: bigint | null | undefined) {
  const apiIdentity = useApiCacheIdentity();
  const validId = vaultId != null && vaultId >= 0n;

  return useQuery({
    queryKey: qk.msvaultVault(apiIdentity, validId ? vaultId.toString() : ""),
    queryFn: () => fetchMsvaultDetail(vaultId!),
    enabled: validId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useMsvaultManagedAsset(
  asset: MsvaultAssetRef | null | undefined,
  owner: string | null | undefined,
) {
  const apiIdentity = useApiCacheIdentity();
  const assetKey = asset ? `${asset.issuer}:${asset.assetName.toString()}` : "";

  return useQuery({
    queryKey: qk.msvaultManagedAsset(apiIdentity, owner ?? "", assetKey),
    queryFn: () => getMsvaultManagedAssetBalance(asset!, owner!),
    enabled: !!asset?.issuer && asset.assetName > 0n && !!owner,
    refetchInterval: 10_000,
  });
}

export function useMsvaultAssetMeta(asset: MsvaultAssetRef | null | undefined) {
  const apiIdentity = useApiCacheIdentity();
  const name = asset ? asset.name || decodeAssetName(asset.assetName) : "";

  return useQuery({
    queryKey: qk.msvaultAssetMeta(apiIdentity, asset?.issuer ?? "", name),
    queryFn: async (): Promise<MsvaultAssetMeta> => {
      if (!asset) return { name, decimals: 0, unit: null };

      const { data, error, response } = await getAsset({
        path: { issuer: asset.issuer, name },
        throwOnError: false,
      });
      if (error) {
        if (response?.status === 404) return { name, decimals: 0, unit: null };
        throw error instanceof Error ? error : new Error("Asset metadata unavailable");
      }

      const metadata = data?.data;
      return {
        name: metadata?.name || name,
        decimals: metadata?.decimals ?? 0,
        unit: metadata?.unit ?? null,
      };
    },
    enabled: !!asset?.issuer && asset.assetName > 0n,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
