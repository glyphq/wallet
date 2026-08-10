import type { ContractCall } from "@qubic.org/contracts";
import { buildQxTransferShareOwnershipAndPossessionInput, QX_CONTRACT_INDEX } from "@qubic.org/contracts";
import type { Identity } from "@qubic.org/types";
import { identityToPublicKey, isValidIdentity } from "@/lib/crypto";
import type { OwnedAssetItem } from "@/hooks/use-owned-assets";

const MAX_DECIMAL_PLACES = 18;

export interface AssetTransferValidationInput {
  asset: Pick<OwnedAssetItem, "name" | "numberOfUnits" | "managingContractIndex" | "issuerIdentity" | "numberOfDecimalPlaces">;
  sourceIdentity: string;
  recipientIdentity: string;
  amountText: string;
  qxTransferFee: bigint | null;
  quBalance: bigint | null;
}

export interface AssetTransferValidationResult {
  ok: boolean;
  recipientError: string;
  amountError: string;
  formError: string;
  units: bigint;
}

export function assetNameToBigInt(name: string): bigint {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 7) throw new Error("Asset name must be 1 to 7 characters");

  let value = 0n;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code > 0xff) throw new Error("Asset name must use single-byte characters");
    value |= BigInt(code) << (8n * BigInt(i));
  }
  return value;
}

function grouped(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatAssetUnits(unitsInput: bigint | string, decimals: number): string {
  try {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMAL_PLACES) return "—";
    const raw = BigInt(unitsInput);
    const sign = raw < 0n ? "-" : "";
    const units = raw < 0n ? -raw : raw;
    const scale = 10n ** BigInt(decimals);
    const whole = units / scale;
    if (decimals === 0) return `${sign}${grouped(whole.toString())}`;
    const fraction = (units % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${sign}${grouped(whole.toString())}${fraction ? `.${fraction}` : ""}`;
  } catch {
    return "—";
  }
}

export function parseAssetAmount(amountText: string, decimals: number): { ok: true; units: bigint } | { ok: false; error: string } {
  const raw = amountText.trim();
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMAL_PLACES) {
    return { ok: false, error: "Unsupported asset decimal precision" };
  }
  if (!raw) return { ok: false, error: "Enter an amount" };
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return { ok: false, error: "Enter a valid amount" };

  const [whole, fraction = ""] = raw.split(".");
  if (decimals === 0 && fraction.length > 0) return { ok: false, error: "This asset only accepts whole units" };
  if (fraction.length > decimals) return { ok: false, error: `Use at most ${decimals} decimal place${decimals === 1 ? "" : "s"}` };

  const scale = 10n ** BigInt(decimals);
  const units = BigInt(whole) * scale + BigInt((fraction || "").padEnd(decimals, "0") || "0");
  if (units <= 0n) return { ok: false, error: "Amount must be greater than 0" };
  return { ok: true, units };
}

export function validateQxAssetTransfer({
  asset,
  sourceIdentity,
  recipientIdentity,
  amountText,
  qxTransferFee,
  quBalance,
}: AssetTransferValidationInput): AssetTransferValidationResult {
  const recipient = recipientIdentity.trim().toUpperCase();
  let recipientError = "";
  let amountError = "";
  let formError = "";
  let units = 0n;

  if (asset.managingContractIndex !== QX_CONTRACT_INDEX) {
    formError = "Only QX-managed assets can be transferred here";
  }

  if (!isValidIdentity(recipient)) {
    recipientError = "Invalid identity";
  } else if (recipient === sourceIdentity) {
    recipientError = "Recipient must be a different identity";
  }

  const parsed = parseAssetAmount(amountText, asset.numberOfDecimalPlaces);
  if (!parsed.ok) {
    amountError = parsed.error;
  } else {
    units = parsed.units;
    try {
      if (units > BigInt(asset.numberOfUnits)) amountError = "Amount is higher than your asset balance";
    } catch {
      amountError = "Asset balance is unavailable";
    }
  }

  if (!formError && qxTransferFee === null) formError = "QX transfer fee is unavailable";
  if (!formError && qxTransferFee !== null && quBalance !== null && qxTransferFee > quBalance) formError = "Insufficient QU for the QX transfer fee";

  return {
    ok: !recipientError && !amountError && !formError,
    recipientError,
    amountError,
    formError,
    units,
  };
}

export function buildQxAssetTransferCall({
  asset,
  recipientIdentity,
  units,
}: {
  asset: Pick<OwnedAssetItem, "name" | "issuerIdentity">;
  recipientIdentity: string;
  units: bigint;
}): ContractCall {
  return buildQxTransferShareOwnershipAndPossessionInput(
    {
      issuer: asset.issuerIdentity,
      newOwnerAndPossessor: recipientIdentity.trim().toUpperCase() as Identity,
      assetName: assetNameToBigInt(asset.name),
      numberOfShares: units,
    },
    (identity) => identityToPublicKey(identity as Identity),
  );
}
