import { publicKeyToIdentity } from "@glyph-oss/contracts";
import { isValidIdentity } from "@/lib/crypto";
import { hexToBytes } from "@/lib/hex";

export const MSVAULT_REVOKE_FEE = 100n;
export const MSVAULT_MAX_OWNERS = 16;
export const MSVAULT_MAX_ASSET_TYPES = 8;
export const NULL_DESTINATION = publicKeyToIdentity(new Uint8Array(32));

const VAULT_NAME_BYTES = 32;
const VAULT_NAME_MAX_BYTES = 32;
const ASSET_NAME_PATTERN = /^[A-Z0-9]{1,7}$/;
const MAX_ASSET_DECIMALS = 77;

export interface MsvaultAssetRef {
  issuer: string;
  assetName: bigint;
  name: string;
}

export interface MsvaultAssetBalance {
  asset: MsvaultAssetRef;
  amount: bigint;
}

export interface MsvaultOwner {
  index: number;
  identity: string;
}

export type MsvaultReleaseKind = "qubic" | "asset";

export interface MsvaultProposal {
  key: string;
  kind: MsvaultReleaseKind;
  asset: MsvaultAssetRef | null;
  amount: bigint;
  destination: string;
  supporters: number[];
  approvals: number;
  requiredApprovals: number;
}

export interface MsvaultDetail {
  id: bigint;
  name: string;
  balance: bigint;
  owners: string[];
  requiredApprovals: number;
  assets: MsvaultAssetBalance[];
  proposals: MsvaultProposal[];
}

export interface MsvaultFees {
  registeringFee: bigint;
  releaseFee: bigint;
  releaseResetFee: bigint;
  holdingFee: bigint;
  depositFee: bigint;
  burnFee: bigint;
}

export interface MsvaultListEntry {
  id: bigint;
  name: string;
  detail: MsvaultDetail | null;
  error: Error | null;
}

export interface MsvaultAssetMeta {
  name: string;
  decimals: number;
  unit: string | null;
}

export interface MsvaultConfigInput {
  name: string;
  owners: readonly string[];
  requiredApprovals: number;
}

export interface MsvaultReleaseProposalInput {
  owners: readonly string[];
  requiredApprovals: number;
  amounts: readonly bigint[];
  destinations: readonly string[];
  assets: readonly (MsvaultAssetRef | null | undefined)[];
  assetAmounts: readonly bigint[];
  assetDestinations: readonly string[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Encodes a vault name as a zero-padded 32-byte payload. */
export function encodeVaultName(name: string): Uint8Array {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Vault name is required");
  const bytes = encoder.encode(trimmed);
  if (bytes.length === 0 || bytes.length > VAULT_NAME_MAX_BYTES) {
    throw new Error(`Vault name must be 1-${VAULT_NAME_MAX_BYTES} bytes`);
  }
  const payload = new Uint8Array(VAULT_NAME_BYTES);
  payload.set(bytes);
  return payload;
}

/** Decodes a zero-terminated hex vault name, returning an empty string when malformed. */
export function decodeVaultName(hex: string): string {
  const bytes = hexToBytes(hex);
  if (!bytes) return "";
  const end = bytes.indexOf(0);
  return decoder.decode(end === -1 ? bytes : bytes.subarray(0, end));
}

/** Packs a 1-7 ASCII asset name little-endian into a u64. */
export function encodeAssetName(name: string): bigint {
  const normalized = name.trim().toUpperCase();
  if (!ASSET_NAME_PATTERN.test(normalized)) {
    throw new Error("Asset name must be 1-7 uppercase letters or digits");
  }
  let value = 0n;
  for (let index = 0; index < normalized.length; index++) {
    value |= BigInt(normalized.charCodeAt(index)) << (8n * BigInt(index));
  }
  return value;
}

/** Decodes a little-endian packed asset name, returning an empty string when invalid. */
export function decodeAssetName(value: bigint): string {
  if (value < 0n) return "";
  const bytes: number[] = [];
  let remaining = value;
  for (let index = 0; index < 8; index++) {
    const byte = Number(remaining & 0xffn);
    remaining >>= 8n;
    if (byte === 0) break;
    bytes.push(byte);
  }
  const name = String.fromCharCode(...bytes);
  return ASSET_NAME_PATTERN.test(name) ? name : "";
}

/** Parses whole or decimal asset units into raw shares, rejecting zero and excess precision. */
export function parseAssetAmount(text: string, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_ASSET_DECIMALS) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const pattern =
    decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(trimmed)) return null;

  const [whole, fraction = ""] = trimmed.split(".");
  const scale = 10n ** BigInt(decimals);
  const fractionValue = fraction ? BigInt(fraction.padEnd(decimals, "0")) : 0n;
  const raw = BigInt(whole) * scale + fractionValue;
  return raw > 0n ? raw : null;
}

/** Formats raw asset shares without converting the value through Number. */
export function formatAssetAmount(shares: bigint, decimals: number): string {
  const safeDecimals =
    Number.isInteger(decimals) && decimals > 0 && decimals <= MAX_ASSET_DECIMALS ? decimals : 0;
  const negative = shares < 0n;
  const absolute = negative ? -shares : shares;
  const scale = 10n ** BigInt(safeDecimals);
  const whole = absolute / scale;
  const fraction =
    safeDecimals > 0
      ? (absolute % scale).toString().padStart(safeDecimals, "0").replace(/0+$/, "")
      : "";
  const groupedWhole = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${groupedWhole}${fraction ? `.${fraction}` : ""}`;
}

export function defaultRequiredApprovals(ownerCount: number): number {
  return Math.floor(ownerCount / 2) + 1;
}

/** Returns the owner's slot index, or -1 when the identity is not an owner. */
export function ownerIndex(owners: readonly string[], identity: string): number {
  const target = identity.trim().toUpperCase();
  return owners.findIndex((owner) => owner.trim().toUpperCase() === target);
}

/** Validates a create-vault configuration; returns an empty string when valid. */
export function validateMultisigConfig(input: MsvaultConfigInput): string {
  const name = input.name.trim();
  if (!name) return "Vault name required";
  if (encoder.encode(name).length > VAULT_NAME_MAX_BYTES) {
    return `Vault name must be at most ${VAULT_NAME_MAX_BYTES} bytes`;
  }

  const owners = input.owners.map((owner) => owner.trim().toUpperCase());
  if (owners.length < 2 || owners.length > MSVAULT_MAX_OWNERS) {
    return `Add 2 to ${MSVAULT_MAX_OWNERS} owners`;
  }
  if (owners.some((owner) => !isValidIdentity(owner))) return "Invalid address";
  if (new Set(owners).size !== owners.length) return "Owners must be unique";

  const { requiredApprovals } = input;
  if (
    !Number.isInteger(requiredApprovals) ||
    requiredApprovals < 2 ||
    requiredApprovals > owners.length
  ) {
    return `Approvals must be 2 to ${owners.length}`;
  }
  return "";
}

/** Groups owner approval slots into exact release proposals. */
export function buildReleaseProposals(input: MsvaultReleaseProposalInput): MsvaultProposal[] {
  const { owners, requiredApprovals } = input;
  const proposals = new Map<string, MsvaultProposal>();

  const add = (
    kind: MsvaultReleaseKind,
    asset: MsvaultAssetRef | null,
    amount: bigint,
    destination: string,
    supporter: number,
  ) => {
    if (amount === 0n) return;
    if (destination === NULL_DESTINATION) return;
    if (kind === "asset" && (!asset || asset.assetName === 0n || !asset.issuer.trim())) return;

    const assetKey = asset ? `${asset.issuer}:${asset.assetName.toString()}` : "";
    const key = `${kind}:${assetKey}:${amount.toString()}:${destination}`;
    const existing = proposals.get(key);
    if (existing) {
      existing.supporters.push(supporter);
      existing.approvals = existing.supporters.length;
      return;
    }

    proposals.set(key, {
      key,
      kind,
      asset: asset ? { ...asset } : null,
      amount,
      destination,
      supporters: [supporter],
      approvals: 1,
      requiredApprovals,
    });
  };

  for (let index = 0; index < owners.length; index++) {
    const amount = input.amounts[index];
    const destination = input.destinations[index];
    if (amount !== undefined && destination !== undefined) {
      add("qubic", null, amount, destination, index);
    }

    const asset = input.assets[index];
    const assetAmount = input.assetAmounts[index];
    const assetDestination = input.assetDestinations[index];
    if (asset && assetAmount !== undefined && assetDestination !== undefined) {
      add("asset", asset, assetAmount, assetDestination, index);
    }
  }

  return [...proposals.values()].sort((a, b) => {
    const aReady = a.approvals >= a.requiredApprovals ? 1 : 0;
    const bReady = b.approvals >= b.requiredApprovals ? 1 : 0;
    if (aReady !== bReady) return bReady - aReady;
    if (a.approvals !== b.approvals) return b.approvals - a.approvals;
    if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
    return 0;
  });
}

/** Epochs the vault balance can cover the holding fee, or null when the fee is zero. */
export function vaultHoldingCoverage(balance: bigint, holdingFee: bigint): bigint | null {
  if (holdingFee === 0n) return null;
  return balance / holdingFee;
}
