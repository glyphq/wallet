import type { MouseEvent, ReactNode } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { formatDate, truncateId } from "@/lib/format";

const PERMISSION_LABELS: Record<string, string> = {
  transfer: "Transfer",
  sc_call: "Contract calls",
  sign_message: "Sign messages",
};

function SettingsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-caption)",
      fontWeight: 600,
      color: "var(--color-text-disabled)",
      letterSpacing: "0.06em",
    }}>
      {children}
    </span>
  );
}

function SettingsDivider() {
  return <div style={{ height: 1, background: "var(--color-border-subtle)" }} />;
}

function OutlineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

function GlobeIcon() {
  return (
    <OutlineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18" />
      <path d="M12 3a13 13 0 0 0 0 18" />
    </OutlineIcon>
  );
}

function UserIcon() {
  return (
    <OutlineIcon>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </OutlineIcon>
  );
}

function ShieldIcon() {
  return (
    <OutlineIcon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </OutlineIcon>
  );
}

function SlashIcon() {
  return (
    <OutlineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6 18.4 18.4" />
    </OutlineIcon>
  );
}

function ChevronIcon() {
  return (
    <OutlineIcon>
      <path d="m8 10 4 4 4-4" />
    </OutlineIcon>
  );
}

function SmallActionButton({
  children,
  ariaLabel,
  onClick,
}: {
  children: ReactNode;
  ariaLabel: string;
  onClick: () => void;
}) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      style={{
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        fontWeight: 600,
        color: "var(--color-status-error)",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function DappsScreen() {
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const vaults = usePersistedStore((s) => s.vaults);
  const revokeDapp = usePersistedStore((s) => s.revokeDapp);
  const revokeDappPermission = usePersistedStore((s) => s.revokeDappPermission);
  const setDappAllowedIdentities = usePersistedStore((s) => s.setDappAllowedIdentities);

  const sortedDapps = approvedDapps
    .slice()
    .sort((a, b) => (b.lastUsedAt ?? b.approvedAt) - (a.lastUsedAt ?? a.approvedAt));

  function getIdentityLabel(identity: string) {
    for (const vault of vaults) {
      const account = vault.accounts.find((candidate) => candidate.identity === identity);
      if (account) return `${account.name} · ${truncateId(identity, 8, 4)}`;
    }
    return truncateId(identity, 8, 4);
  }

  function revokeIdentityScope(origin: string, identity: string, allowedIdentities: string[] | undefined) {
    if (!allowedIdentities) {
      revokeDapp(origin);
      return;
    }

    const next = allowedIdentities.filter((candidate) => candidate !== identity);
    if (next.length === 0) revokeDapp(origin);
    else setDappAllowedIdentities(origin, next);
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Approved dApps" />

        {sortedDapps.length === 0 ? (
          <div style={{
            padding: "var(--space-8) 0",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
            color: "var(--color-text-secondary)",
          }}>
            No approved dApps
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {sortedDapps.map((dapp, i) => {
              const accountCount = dapp.allowedIdentities?.length;
              const accountSummary = accountCount ? `${accountCount} shared ${accountCount === 1 ? "account" : "accounts"}` : "All accounts";
              const permissionSummary = dapp.permissions.length === 0
                ? "No extra permissions"
                : `${dapp.permissions.length} ${dapp.permissions.length === 1 ? "permission" : "permissions"}`;

              return (
                <div key={dapp.origin}>
                  {i > 0 && <SettingsDivider />}
                  <details open style={{ padding: "var(--space-4) 0" }}>
                    <summary style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      cursor: "pointer",
                      listStyle: "none",
                    }}>
                      <div style={{ display: "flex", gap: "var(--space-3)", minWidth: 0, flex: 1 }}>
                        <span style={{ color: "var(--color-text-tertiary)", paddingTop: 2 }}>
                          <GlobeIcon />
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {dapp.name}
                            </span>
                            <span style={{ color: "var(--color-text-disabled)", display: "inline-flex" }}>
                              <ChevronIcon />
                            </span>
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", marginTop: "var(--space-1)", overflowWrap: "anywhere" }}>
                            {dapp.origin}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", columnGap: "var(--space-3)", rowGap: "var(--space-1)", marginTop: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                            <span>{accountSummary}</span>
                            <span>{permissionSummary}</span>
                            <span>Approved {formatDate(dapp.approvedAt)}</span>
                            {dapp.lastUsedAt && <span>Last used {formatDate(dapp.lastUsedAt)}</span>}
                          </div>
                        </div>
                      </div>
                      <SmallActionButton ariaLabel={`Revoke ${dapp.name}`} onClick={() => revokeDapp(dapp.origin)}>
                        <SlashIcon />
                        Revoke
                      </SmallActionButton>
                    </summary>

                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-4)", paddingLeft: "calc(16px + var(--space-3))" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <SettingsSectionLabel>Shared accounts</SettingsSectionLabel>
                        {dapp.allowedIdentities && dapp.allowedIdentities.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {dapp.allowedIdentities.map((identity, identityIndex) => {
                              const identityLabel = getIdentityLabel(identity);

                              return (
                                <div key={identity}>
                                  {identityIndex > 0 && <SettingsDivider />}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 44 }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", minWidth: 0 }}>
                                      <span style={{ color: "var(--color-text-tertiary)" }}><UserIcon /></span>
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identityLabel}</span>
                                    </span>
                                    <SmallActionButton
                                      ariaLabel={`Remove ${identityLabel} from ${dapp.name}`}
                                      onClick={() => revokeIdentityScope(dapp.origin, identity, dapp.allowedIdentities)}
                                    >
                                      Remove
                                    </SmallActionButton>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", minHeight: 44 }}>
                            <span style={{ color: "var(--color-text-tertiary)" }}><UserIcon /></span>
                            All accounts in this Vault
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <SettingsSectionLabel>Permissions</SettingsSectionLabel>
                        {dapp.permissions.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {dapp.permissions.map((permission, permissionIndex) => (
                              <div key={permission}>
                                {permissionIndex > 0 && <SettingsDivider />}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 44 }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                                    <span style={{ color: "var(--color-text-tertiary)" }}><ShieldIcon /></span>
                                    {PERMISSION_LABELS[permission] ?? permission}
                                  </span>
                                  <SmallActionButton
                                    ariaLabel={`Remove ${PERMISSION_LABELS[permission] ?? permission} permission from ${dapp.name}`}
                                    onClick={() => revokeDappPermission(dapp.origin, permission)}
                                  >
                                    Remove
                                  </SmallActionButton>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", minHeight: 44 }}>
                            <span style={{ color: "var(--color-text-tertiary)" }}><ShieldIcon /></span>
                            No extra permissions granted
                          </span>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
