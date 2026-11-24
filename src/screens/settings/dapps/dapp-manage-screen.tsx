import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { OptionSelector } from "@/components/option-selector";
import { PageFrame } from "@/components/page-header";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { Toggle } from "@/components/toggle";
import { truncateId } from "@/lib/format";
import { DAPP_EXPIRY_OPTIONS, DAPP_PERMISSION_LABELS, makeDappExpiresAt, sanitizeTransferLimitQu } from "@/lib/dapp-permissions";
import { usePersistedStore } from "@/store/persisted";


const EXPIRY_OPTIONS = DAPP_EXPIRY_OPTIONS.map((option) => ({
  value: option.value === undefined ? "never" : String(option.value),
  label: option.label,
}));

export default function DappManageScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origin = searchParams.get("origin") ?? "";

  const dapp = usePersistedStore((s) => s.settings.approvedDapps.find((candidate) => candidate.origin === origin));
  const wallets = usePersistedStore((s) => s.wallets);
  const revokeDappPermission = usePersistedStore((s) => s.revokeDappPermission);
  const setDappAllowedIdentities = usePersistedStore((s) => s.setDappAllowedIdentities);
  const setDappPolicy = usePersistedStore((s) => s.setDappPolicy);

  const [transferLimit, setTransferLimit] = useState(dapp?.transferLimitQu ?? "");

  const listPath = "/settings/dapps";
  const detailPath = `/settings/dapps/detail?origin=${encodeURIComponent(origin)}`;

  const accounts = (() => {
    const seen = new Set<string>();
    return wallets.flatMap((wallet) => wallet.accounts.flatMap((account) => {
      if (!account.identity || seen.has(account.identity)) return [];
      seen.add(account.identity);
      return [{ identity: account.identity, name: account.name }];
    }));
  })();
  if (dapp?.allowedIdentities) {
    const known = new Set(accounts.map((account) => account.identity));
    for (const identity of dapp.allowedIdentities) {
      if (!known.has(identity)) {
        known.add(identity);
        accounts.push({ identity, name: "Unknown account" });
      }
    }
  }
  const allIdentities = accounts.map((account) => account.identity);
  const selectedIdentities = new Set(dapp?.allowedIdentities ?? allIdentities);

  function setShared(identity: string, shared: boolean) {
    if (!dapp) return;
    const next = new Set(selectedIdentities);
    if (shared) next.add(identity);
    else if (next.size > 1) next.delete(identity);
    else return;
    setDappAllowedIdentities(dapp.origin, next.size === allIdentities.length ? undefined : [...next]);
  }

  function commitLimit() {
    if (!dapp) return;
    const sanitized = sanitizeTransferLimitQu(transferLimit) ?? "";
    setTransferLimit(sanitized);
    setDappPolicy(dapp.origin, {
      transferLimitQu: sanitized,
      expiryDurationMs: dapp.expiryDurationMs,
      expiresAt: dapp.expiresAt,
    });
  }

  function setExpiry(value: string) {
    if (!dapp) return;
    const duration = value === "never" ? undefined : Number(value);
    setDappPolicy(dapp.origin, {
      transferLimitQu: sanitizeTransferLimitQu(transferLimit),
      expiryDurationMs: duration,
      expiresAt: duration === undefined ? undefined : makeDappExpiresAt(duration),
    });
  }

  if (!dapp) {
    return (
      <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
        <SettingsPageHeader title="Manage access" backTo={listPath} />
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

  const hasTransferLikePermission = dapp.permissions.some((permission) => permission === "transfer" || permission === "sc_call");
  const expiryValue = dapp.expiryDurationMs === undefined ? "never" : String(dapp.expiryDurationMs);

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <SettingsPageHeader title="Manage access" backTo={detailPath} />
      <PageFrame
        actions={<Button variant="secondary" size="md" style={{ width: "100%" }} onClick={() => navigate(detailPath, { replace: true })}>Done</Button>}
      >
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>{dapp.name}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", overflowWrap: "anywhere" }}>{dapp.origin}</span>
          </div>

          <SettingsDivider fullBleed />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }} aria-label="Shared accounts">
            <SettingsSectionLabel>Shared accounts</SettingsSectionLabel>
            {accounts.length === 0 ? (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>No wallet accounts available.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {accounts.map((account) => {
                  const shared = selectedIdentities.has(account.identity);
                  return (
                    <Toggle
                      key={account.identity}
                      label={account.name}
                      description={truncateId(account.identity, 10, 10)}
                      checked={shared}
                      disabled={shared && selectedIdentities.size <= 1}
                      onChange={(next) => setShared(account.identity, next)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <SettingsDivider fullBleed />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }} aria-label="Permissions">
            <SettingsSectionLabel>Permissions</SettingsSectionLabel>
            {dapp.permissions.length === 0 ? (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>No extra permissions granted.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {dapp.permissions.map((permission) => (
                  <div key={permission} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 44 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                      {DAPP_PERMISSION_LABELS[permission] ?? permission}
                    </span>
                    <Button variant="ghost" size="sm" style={{ width: "auto" }} onClick={() => revokeDappPermission(dapp.origin, permission)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <SettingsDivider fullBleed />

          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} aria-label="Limits">
            <SettingsSectionLabel>Limits</SettingsSectionLabel>
            {hasTransferLikePermission ? (
              <Input
                label="QU limit"
                type="text"
                inputMode="decimal"
                value={transferLimit}
                onChange={(event) => setTransferLimit(event.target.value.replace(/[^\d.]/g, ""))}
                onBlur={commitLimit}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitLimit(); } }}
                placeholder="No limit"
              />
            ) : null}
            <OptionSelector
              label="Expiry"
              value={expiryValue}
              options={EXPIRY_OPTIONS}
              columns={3}
              onChange={setExpiry}
            />
          </section>

        </div>
      </PageFrame>
    </AppShell>
  );
}
