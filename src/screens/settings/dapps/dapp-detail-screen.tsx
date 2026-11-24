import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { DisconnectIcon, Settings01Icon } from "@/lib/icons";
import { PageFrame } from "@/components/page-header";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { DAPP_PERMISSION_LABELS, getDappExpiryLabel, getDappLimitLabel } from "@/lib/dapp-permissions";
import { formatDate, truncateId } from "@/lib/format";
import { usePersistedStore } from "@/store/persisted";


export default function DappDetailScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origin = searchParams.get("origin") ?? "";

  const dapp = usePersistedStore((s) => s.settings.approvedDapps.find((candidate) => candidate.origin === origin));
  const wallets = usePersistedStore((s) => s.wallets);
  const revokeDapp = usePersistedStore((s) => s.revokeDapp);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const listPath = "/settings/dapps";
  const managePath = `/settings/dapps/manage?origin=${encodeURIComponent(origin)}`;

  function identityLabel(identity: string): string {
    for (const wallet of wallets) {
      const account = wallet.accounts.find((candidate) => candidate.identity === identity);
      if (account) return `${account.name} · ${truncateId(identity, 8, 4)}`;
    }
    return truncateId(identity, 8, 4);
  }

  if (!dapp) {
    return (
      <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
        <SettingsPageHeader title="dApp" backTo={listPath} />
        <PageFrame actions={<Button variant="secondary" style={{ width: "100%" }} onClick={() => navigate(listPath, { replace: true })}>Back to approved dApps</Button>}>
          <div style={{ margin: "auto", maxWidth: 420, textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              dApp not found
            </span>
            <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-body-compact)" }}>
              This approval may have already been disconnected.
            </p>
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  const accounts = dapp.allowedIdentities
    ? (dapp.allowedIdentities.length ? dapp.allowedIdentities.map(identityLabel) : ["No shared accounts"])
    : ["All accounts in this wallet"];
  const permissions = dapp.permissions.length
    ? dapp.permissions.map((permission) => DAPP_PERMISSION_LABELS[permission] ?? permission)
    : ["No extra permissions"];
  const hasTransferLikePermission = dapp.permissions.some((permission) => permission === "transfer" || permission === "sc_call");

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <SettingsPageHeader title={dapp.name} backTo={listPath} />
      <PageFrame
        actions={confirmDisconnect ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <p style={{ margin: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)" }}>
              Disconnect <strong style={{ color: "var(--color-text-primary)" }}>{dapp.name}</strong>? It will need to request access again.
            </p>
            <Button variant="danger" size="md" style={{ width: "100%" }} onClick={() => { revokeDapp(dapp.origin); navigate(listPath, { replace: true }); }}>
              <DisconnectIcon size={16} aria-hidden="true" />
              Disconnect dApp
            </Button>
            <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => setConfirmDisconnect(false)}>
              Keep access
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Button size="md" style={{ width: "100%" }} onClick={() => navigate(managePath)}>
              <Settings01Icon size={16} aria-hidden="true" />
              Manage access
            </Button>
            <Button variant="danger" size="md" style={{ width: "100%" }} onClick={() => setConfirmDisconnect(true)}>
              <DisconnectIcon size={16} aria-hidden="true" />
              Disconnect dApp
            </Button>
          </div>
        )}
      >
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="Origin">
            <SettingsSectionLabel>Origin</SettingsSectionLabel>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>
              {dapp.origin}
            </span>
          </section>

          <SettingsDivider fullBleed />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="Shared accounts">
            <SettingsSectionLabel>Shared accounts</SettingsSectionLabel>
            {accounts.map((account) => (
              <span key={account} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", minHeight: 28 }}>
                {account}
              </span>
            ))}
          </section>

          <SettingsDivider fullBleed />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="Permissions">
            <SettingsSectionLabel>Permissions</SettingsSectionLabel>
            {permissions.map((permission) => (
              <span key={permission} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", minHeight: 28 }}>
                {permission}
              </span>
            ))}
          </section>

          <SettingsDivider fullBleed />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }} aria-label="Limits">
            <SettingsSectionLabel>Limits</SettingsSectionLabel>
            {hasTransferLikePermission ? (
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>QU limit</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)" }}>{getDappLimitLabel(dapp)}</span>
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Expiry</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: dapp.expiresAt && dapp.expiresAt <= Date.now() ? "var(--color-status-error)" : "var(--color-text-primary)" }}>{getDappExpiryLabel(dapp)}</span>
            </div>
          </section>

          <div style={{ display: "flex", flexWrap: "wrap", columnGap: "var(--space-4)", rowGap: "var(--space-1)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            <span>Approved {formatDate(dapp.approvedAt)}</span>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
