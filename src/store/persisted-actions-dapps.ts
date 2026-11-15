import type { PersistedStoreSet } from "./persisted-store-set";
import type { ApprovedDapp } from "./persisted-types";
import { sanitizeDappExpiresAt, sanitizeDappExpiryDurationMs, sanitizeTransferLimitQu } from "@/lib/dapp-permissions";

/** dApp approval and policy actions for the persisted store. */
export function createDappActions(set: PersistedStoreSet) {
  return {
    approveDapp: (dapp: ApprovedDapp) =>
      set((s) => {
        const now = Date.now();
        const existing = s.settings.approvedDapps.find(
          (d) => d.origin === dapp.origin
        );
        const transferLimitQu = sanitizeTransferLimitQu(dapp.transferLimitQu);
        const expiryDurationMs = sanitizeDappExpiryDurationMs(dapp.expiryDurationMs);
        const expiresAt = sanitizeDappExpiresAt(dapp.expiresAt);
        const approvedDapps = existing
          ? s.settings.approvedDapps.map((d) =>
              d.origin === dapp.origin
                ? {
                    ...dapp,
                    permissions: [...new Set(dapp.permissions)],
                    allowedIdentities: dapp.allowedIdentities && [...new Set(dapp.allowedIdentities)],
                    transferLimitQu,
                    expiryDurationMs,
                    expiresAt,
                    lastUsedAt: now,
                  }
                : d
            )
          : [...s.settings.approvedDapps, { ...dapp, transferLimitQu, expiryDurationMs, expiresAt, lastUsedAt: now }];
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
      set((s) => {
        const approvedDapps = s.settings.approvedDapps
          .map((d) =>
            d.origin === origin
              ? {
                  ...d,
                  permissions: d.permissions.filter((p) => p !== permission),
                }
              : d
          );
        return { settings: { ...s.settings, approvedDapps } };
      }),

    setDappAllowedIdentities: (origin: string, identities: string[] | undefined) =>
      set((s) => ({
        settings: {
          ...s.settings,
          approvedDapps: s.settings.approvedDapps.map((d) =>
            d.origin === origin ? { ...d, allowedIdentities: identities } : d
          ),
        },
      })),

    setDappPolicy: (
      origin: string,
      policy: Pick<ApprovedDapp, "transferLimitQu" | "expiryDurationMs" | "expiresAt">
    ) =>
      set((s) => ({
        settings: {
          ...s.settings,
          approvedDapps: s.settings.approvedDapps.map((d) =>
            d.origin === origin
              ? {
                  ...d,
                  transferLimitQu: sanitizeTransferLimitQu(policy.transferLimitQu),
                  expiryDurationMs: sanitizeDappExpiryDurationMs(policy.expiryDurationMs),
                  expiresAt: sanitizeDappExpiresAt(policy.expiresAt),
                }
              : d
          ),
        },
      })),
  };
}
