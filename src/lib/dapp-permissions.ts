import type { ApprovedDapp } from "@/store/persisted-types";
import { formatQu } from "@/lib/format";
import type { GlyphPermission } from "@/lib/request-schema";

const MAX_UINT64 = 18_446_744_073_709_551_615n;
const MAX_EXPIRY_DURATION_MS = 365 * 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DAPP_EXPIRY_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "Never", value: undefined },
  { label: "1 day", value: DAY_MS },
  { label: "7 days", value: 7 * DAY_MS },
  { label: "30 days", value: 30 * DAY_MS },
  { label: "90 days", value: 90 * DAY_MS },
  { label: "1 year", value: 365 * DAY_MS },
];

export const DEFAULT_DAPP_EXPIRY_DURATION_MS = 30 * DAY_MS;

export type DappPolicyPermission = Extract<GlyphPermission, "transfer" | "sc_call" | "sign_message">;

export interface DappPolicyPatch {
  transferLimitQu?: string;
  expiryDurationMs?: number;
  expiresAt?: number;
}

export interface DappPermissionDecision {
  allowed: boolean;
  reason: string | null;
  dapp: ApprovedDapp | null;
}

export function sanitizeTransferLimitQu(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") return undefined;
  const normalized = String(value).trim().replace(/[,_\s]/g, "").replace(/qu$/i, "");
  if (!/^\d+$/.test(normalized)) return undefined;
  const amount = BigInt(normalized);
  if (amount <= 0n || amount > MAX_UINT64) return undefined;
  return amount.toString();
}

export function sanitizeDappExpiryDurationMs(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded < MINUTE_MS || rounded > MAX_EXPIRY_DURATION_MS) return undefined;
  return rounded;
}

export function sanitizeDappExpiresAt(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded <= 0 || rounded > Number.MAX_SAFE_INTEGER) return undefined;
  return rounded;
}

export function makeDappExpiresAt(durationMs: number | undefined, now = Date.now()): number | undefined {
  return durationMs === undefined ? undefined : now + durationMs;
}

export function sanitizeApprovedDapp(value: unknown): ApprovedDapp | null {
  if (!value || typeof value !== "object") return null;
  const dapp = value as Partial<ApprovedDapp>;
  if (
    typeof dapp.origin !== "string" ||
    typeof dapp.name !== "string" ||
    typeof dapp.approvedAt !== "number" ||
    !Number.isFinite(dapp.approvedAt) ||
    !Array.isArray(dapp.permissions)
  ) {
    return null;
  }

  const permissions = Array.from(
    new Set(
      dapp.permissions.filter(
        (permission): permission is DappPolicyPermission =>
          permission === "transfer" || permission === "sc_call" || permission === "sign_message",
      ),
    ),
  );
  const allowedIdentities = Array.isArray(dapp.allowedIdentities)
    ? Array.from(new Set(dapp.allowedIdentities.filter((identity): identity is string => typeof identity === "string" && identity.length > 0)))
    : undefined;
  const expiryDurationMs = sanitizeDappExpiryDurationMs(dapp.expiryDurationMs);
  const persistedExpiresAt = sanitizeDappExpiresAt(dapp.expiresAt);
  const derivedExpiresAt = expiryDurationMs === undefined ? undefined : sanitizeDappExpiresAt(dapp.approvedAt + expiryDurationMs);
  const transferLimitQu = permissions.some((permission) => permission === "transfer" || permission === "sc_call")
    ? sanitizeTransferLimitQu(dapp.transferLimitQu)
    : undefined;

  return {
    origin: dapp.origin,
    name: dapp.name,
    approvedAt: dapp.approvedAt,
    lastUsedAt: sanitizeDappExpiresAt(dapp.lastUsedAt),
    permissions,
    allowedIdentities: allowedIdentities && allowedIdentities.length > 0 ? allowedIdentities : undefined,
    transferLimitQu,
    expiryDurationMs,
    expiresAt: persistedExpiresAt ?? derivedExpiresAt,
  };
}

export function getDappExpiryLabel(dapp: Pick<ApprovedDapp, "expiresAt">, now = Date.now()): string {
  if (!dapp.expiresAt) return "Never expires";
  if (dapp.expiresAt <= now) return "Expired";
  const ms = dapp.expiresAt - now;
  const days = Math.ceil(ms / DAY_MS);
  if (days >= 1) return `Expires in ${days}d`;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours >= 1) return `Expires in ${hours}h`;
  return `Expires in ${Math.ceil(ms / MINUTE_MS)}m`;
}

export function getDappLimitLabel(dapp: Pick<ApprovedDapp, "transferLimitQu">): string {
  return dapp.transferLimitQu ? `Limit ${formatQu(dapp.transferLimitQu)} QU` : "No QU limit";
}

export function evaluateDappPermission(input: {
  approvedDapps: ApprovedDapp[];
  origin: string;
  permission: DappPolicyPermission;
  identity?: string | null;
  amountQu?: bigint | null;
  now?: number;
}): DappPermissionDecision {
  const now = input.now ?? Date.now();
  const dapp = input.approvedDapps.find((candidate) => candidate.origin === input.origin) ?? null;

  if (!dapp) {
    return { allowed: false, reason: "Connect this dApp before approving this action.", dapp };
  }
  if (!dapp.permissions.includes(input.permission)) {
    return { allowed: false, reason: "Permission not granted for this dApp.", dapp };
  }
  if (dapp.expiresAt !== undefined && dapp.expiresAt <= now) {
    return { allowed: false, reason: "Connection expired. Reconnect to continue.", dapp };
  }
  if (input.identity && dapp.allowedIdentities && !dapp.allowedIdentities.includes(input.identity)) {
    return { allowed: false, reason: "This account is not shared with this dApp.", dapp };
  }
  if ((input.permission === "transfer" || input.permission === "sc_call") && dapp.transferLimitQu && input.amountQu != null) {
    const limit = BigInt(dapp.transferLimitQu);
    if (input.amountQu > limit) {
      return { allowed: false, reason: `Requested amount exceeds dApp limit of ${formatQu(limit)} QU.`, dapp };
    }
  }

  return { allowed: true, reason: null, dapp };
}
