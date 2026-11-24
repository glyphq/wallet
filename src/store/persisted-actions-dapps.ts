import type { PersistedStoreSet } from "./persisted-store-set";
import type { ApprovedDapp } from "./persisted-types";
import { sanitizeApprovedDapp } from "@/lib/dapp-permissions";

/** dApp approval and policy actions for the persisted store. */
export function createDappActions(set: PersistedStoreSet) {
  return {
    approveDapp: (dapp: ApprovedDapp) =>
      set((s) => {
        const normalized = sanitizeApprovedDapp(dapp);
        if (!normalized) return s;
        const existing = s.settings.approvedDapps.some((candidate) => candidate.origin === normalized.origin);
        const approvedDapps = existing
          ? s.settings.approvedDapps.map((candidate) => candidate.origin === normalized.origin ? normalized : candidate)
          : [...s.settings.approvedDapps, normalized];
        return { settings: { ...s.settings, approvedDapps } };
      }),

    revokeDapp: (origin: string) =>
      set((s) => ({
        settings: {
          ...s.settings,
          approvedDapps: s.settings.approvedDapps.filter(
            (d) => d.origin !== origin
          ),
        },
      })),

    revokeDappPermission: (
      origin: string,
      permission: ApprovedDapp["permissions"][number]
    ) =>
      set((s) => ({
        settings: {
          ...s.settings,
          approvedDapps: s.settings.approvedDapps
            .map((d) => d.origin === origin
              ? sanitizeApprovedDapp({ ...d, permissions: d.permissions.filter((p) => p !== permission) })
              : d)
            .filter((d): d is ApprovedDapp => d !== null),
        },
      })),

    setDappAllowedIdentities: (origin: string, identities: string[] | undefined) =>
      set((s) => ({
        settings: {
          ...s.settings,
          approvedDapps: s.settings.approvedDapps
            .map((d) => d.origin === origin
              ? sanitizeApprovedDapp({
                  ...d,
                  allowedIdentities: identities ? [...new Set(identities)] : undefined,
                })
              : d)
            .filter((d): d is ApprovedDapp => d !== null),
        },
      })),

    setDappPolicy: (
      origin: string,
      policy: Pick<ApprovedDapp, "transferLimitQu" | "expiryDurationMs" | "expiresAt">
    ) =>
      set((s) => ({
        settings: {
          ...s.settings,
          approvedDapps: s.settings.approvedDapps
            .map((d) => d.origin === origin
              ? sanitizeApprovedDapp({
                  ...d,
                  transferLimitQu: policy.transferLimitQu,
                  expiryDurationMs: policy.expiryDurationMs,
                  expiresAt: policy.expiresAt,
                })
              : d)
            .filter((d): d is ApprovedDapp => d !== null),
        },
      })),
  };
}
