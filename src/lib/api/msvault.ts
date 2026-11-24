import { MSVAULT } from "@glyph-oss/contracts";
import { queryContractFunction } from "@/lib/api/contracts";
import {
  buildReleaseProposals,
  decodeAssetName,
  decodeVaultName,
  type MsvaultAssetBalance,
  type MsvaultAssetRef,
  type MsvaultDetail,
  type MsvaultFees,
  type MsvaultListEntry,
} from "@/lib/msvault";

/** Raised when a contract getter reports that a vault is inactive or missing. */
export class MsvaultInactiveError extends Error {
  constructor(message = "This vault is inactive") {
    super(message);
    this.name = "MsvaultInactiveError";
  }
}

export interface MsvaultVaultsResult {
  id: bigint;
  name: string;
}

export interface MsvaultVaultNameResult {
  status: bigint;
  name: string;
}

export interface MsvaultOwnersResult {
  status: bigint;
  numberOfOwners: number;
  owners: string[];
  requiredApprovals: bigint;
}

export interface MsvaultBalanceResult {
  status: bigint;
  balance: bigint;
}

export interface MsvaultReleaseStatusResult {
  status: bigint;
  amounts: bigint[];
  destinations: string[];
}

export interface MsvaultAssetBalancesResult {
  status: bigint;
  assets: MsvaultAssetBalance[];
}

export interface MsvaultAssetReleaseStatusResult {
  status: bigint;
  assets: MsvaultAssetRef[];
  amounts: bigint[];
  destinations: string[];
}

function trimToCount<T>(items: readonly T[], count: bigint | number): T[] {
  const size = typeof count === "bigint" ? Number(count) : count;
  if (!Number.isFinite(size) || size <= 0) return [];
  return items.slice(0, Math.floor(size));
}

export async function getMsvaultFees(): Promise<MsvaultFees> {
  const result = await queryContractFunction(MSVAULT, "getFees", {});
  if (!result.ok) throw result.error;

  return {
    registeringFee: result.value.registeringFee,
    releaseFee: result.value.releaseFee,
    releaseResetFee: result.value.releaseResetFee,
    holdingFee: result.value.holdingFee,
    depositFee: result.value.depositFee,
    burnFee: result.value.burnFee,
  };
}

export async function getMsvaultVaults(publicKey: string): Promise<MsvaultVaultsResult[]> {
  const result = await queryContractFunction(
    MSVAULT,
    "getVaults",
    { publicKey },
    { decode: { idFormat: "hex" } },
  );
  if (!result.ok) throw result.error;

  const count = result.value.numberOfVaults;
  const ids = trimToCount(result.value.vaultIds, count);
  const names = trimToCount(result.value.vaultNames, count);
  return ids.map((id, index) => ({ id, name: decodeVaultName(names[index] ?? "") }));
}

export async function getMsvaultVaultName(vaultId: bigint): Promise<MsvaultVaultNameResult> {
  const result = await queryContractFunction(
    MSVAULT,
    "getVaultName",
    { vaultId },
    { decode: { idFormat: "hex" } },
  );
  if (!result.ok) throw result.error;

  return {
    status: result.value.status,
    name: decodeVaultName(result.value.vaultName),
  };
}

export async function getMsvaultVaultOwners(vaultId: bigint): Promise<MsvaultOwnersResult> {
  const result = await queryContractFunction(MSVAULT, "getVaultOwners", { vaultId });
  if (!result.ok) throw result.error;

  return {
    status: result.value.status,
    numberOfOwners: Number(result.value.numberOfOwners),
    owners: trimToCount(result.value.owners, result.value.numberOfOwners),
    requiredApprovals: result.value.requiredApprovals,
  };
}

export async function getMsvaultBalanceOf(vaultId: bigint): Promise<MsvaultBalanceResult> {
  const result = await queryContractFunction(MSVAULT, "getBalanceOf", { vaultId });
  if (!result.ok) throw result.error;

  return { status: result.value.status, balance: result.value.balance };
}

export async function getMsvaultReleaseStatus(
  vaultId: bigint,
): Promise<MsvaultReleaseStatusResult> {
  const result = await queryContractFunction(MSVAULT, "getReleaseStatus", { vaultId });
  if (!result.ok) throw result.error;

  return {
    status: result.value.status,
    amounts: result.value.amounts,
    destinations: result.value.destinations,
  };
}

export async function getMsvaultAssetBalances(
  vaultId: bigint,
): Promise<MsvaultAssetBalancesResult> {
  const result = await queryContractFunction(MSVAULT, "getVaultAssetBalances", { vaultId });
  if (!result.ok) throw result.error;

  const balances = trimToCount(result.value.assetBalances, result.value.numberOfAssetTypes);
  return {
    status: result.value.status,
    assets: balances.map((entry) => ({
      asset: {
        issuer: entry.asset.issuer,
        assetName: entry.asset.assetName,
        name: decodeAssetName(entry.asset.assetName),
      },
      amount: entry.balance,
    })),
  };
}

export async function getMsvaultAssetReleaseStatus(
  vaultId: bigint,
): Promise<MsvaultAssetReleaseStatusResult> {
  const result = await queryContractFunction(MSVAULT, "getAssetReleaseStatus", { vaultId });
  if (!result.ok) throw result.error;

  return {
    status: result.value.status,
    assets: result.value.assets.map((asset) => ({
      issuer: asset.issuer,
      assetName: asset.assetName,
      name: decodeAssetName(asset.assetName),
    })),
    amounts: result.value.amounts,
    destinations: result.value.destinations,
  };
}

export async function getMsvaultManagedAssetBalance(
  asset: MsvaultAssetRef,
  owner: string,
): Promise<bigint> {
  const result = await queryContractFunction(MSVAULT, "getManagedAssetBalance", {
    asset: { issuer: asset.issuer, assetName: asset.assetName },
    owner,
  });
  if (!result.ok) throw result.error;

  return result.value.balance;
}

export async function fetchMsvaultDetail(
  vaultId: bigint,
  knownName?: string,
): Promise<MsvaultDetail> {
  const namePromise: Promise<MsvaultVaultNameResult> =
    knownName && knownName.length > 0
      ? Promise.resolve({ status: 1n, name: knownName })
      : getMsvaultVaultName(vaultId);

  const [
    nameResult,
    ownersResult,
    balanceResult,
    releaseResult,
    assetBalancesResult,
    assetReleaseResult,
  ] = await Promise.all([
    namePromise,
    getMsvaultVaultOwners(vaultId),
    getMsvaultBalanceOf(vaultId),
    getMsvaultReleaseStatus(vaultId),
    getMsvaultAssetBalances(vaultId),
    getMsvaultAssetReleaseStatus(vaultId),
  ]);

  if (nameResult.status !== 1n || balanceResult.status !== 1n) {
    throw new MsvaultInactiveError();
  }

  const owners = ownersResult.status === 1n ? ownersResult.owners : [];
  const assets = assetBalancesResult.status === 1n ? assetBalancesResult.assets : [];

  const releaseStatus = releaseResult.status === 1n ? releaseResult : null;
  const assetReleaseStatus = assetReleaseResult.status === 1n ? assetReleaseResult : null;

  const amounts = releaseStatus ? releaseStatus.amounts.slice(0, owners.length) : [];
  const destinations = releaseStatus ? releaseStatus.destinations.slice(0, owners.length) : [];
  const assetSlots = assetReleaseStatus ? assetReleaseStatus.assets.slice(0, owners.length) : [];
  const assetAmounts = assetReleaseStatus ? assetReleaseStatus.amounts.slice(0, owners.length) : [];
  const assetDestinations = assetReleaseStatus
    ? assetReleaseStatus.destinations.slice(0, owners.length)
    : [];

  const proposals = buildReleaseProposals({
    owners,
    requiredApprovals: Number(ownersResult.requiredApprovals),
    amounts,
    destinations,
    assets: assetSlots,
    assetAmounts,
    assetDestinations,
  });

  return {
    id: vaultId,
    name: nameResult.name,
    balance: balanceResult.balance,
    owners,
    requiredApprovals: Number(ownersResult.requiredApprovals),
    assets,
    proposals,
  };
}

export async function fetchMsvaultList(identity: string): Promise<MsvaultListEntry[]> {
  const vaults = await getMsvaultVaults(identity);
  const seen = new Set<string>();
  const unique = vaults.filter((vault) => {
    const key = vault.id.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const settled = await Promise.allSettled(
    unique.map((vault) => fetchMsvaultDetail(vault.id, vault.name || undefined)),
  );

  return unique.map((vault, index) => {
    const result = settled[index];
    if (result.status === "fulfilled") {
      return {
        id: vault.id,
        name: vault.name || result.value.name,
        detail: result.value,
        error: null,
      };
    }
    return {
      id: vault.id,
      name: vault.name,
      detail: null,
      error:
        result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
    };
  });
}
