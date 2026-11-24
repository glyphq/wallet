import { useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { formatDate } from "@/lib/format";
import { usePersistedStore } from "@/store/persisted";
import { REQUEST_ACTION_LABEL, REQUEST_CALLBACK_LABEL, REQUEST_TYPE_LABEL } from "./request-history-labels";

function actionColor(action: "approved" | "rejected" | "expired") {
  if (action === "approved") return "var(--color-accent)";
  if (action === "expired") return "var(--color-status-warning)";
  return "var(--color-status-error)";
}

export default function RequestHistoryDetailScreen() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const item = usePersistedStore((s) => s.requestHistory.find((candidate) => candidate.id === id));

  if (!item) {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column" }}>
        <SettingsPageHeader title="Request" backTo="/settings/request-history" />
        <div style={{ margin: "auto", maxWidth: 420, textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Request not found
          </span>
          <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-body-compact)" }}>
            This history entry may have been cleared.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column" }}>
      <SettingsPageHeader title={REQUEST_TYPE_LABEL[item.type]} backTo="/settings/request-history" />
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="dApp">
          <SettingsSectionLabel>dApp</SettingsSectionLabel>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
            {item.dappName || "Unknown dApp"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>
            {item.dappOrigin}
          </span>
        </section>

        <SettingsDivider fullBleed />

        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="Decision">
          <SettingsSectionLabel>Decision</SettingsSectionLabel>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: actionColor(item.action) }}>
            {REQUEST_ACTION_LABEL[item.action]}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            {formatDate(item.createdAt) || "—"}
          </span>
        </section>

        {item.accountName || item.accountIdentity ? (
          <>
            <SettingsDivider fullBleed />
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="Account">
              <SettingsSectionLabel>Account</SettingsSectionLabel>
              {item.accountName ? (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>{item.accountName}</span>
              ) : null}
              {item.accountIdentity ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", overflowWrap: "anywhere" }}>{item.accountIdentity}</span>
              ) : null}
            </section>
          </>
        ) : null}

        {item.resultDetail ? (
          <>
            <SettingsDivider fullBleed />
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="Result">
              <SettingsSectionLabel>Result</SettingsSectionLabel>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", overflowWrap: "anywhere" }}>{item.resultDetail}</span>
            </section>
          </>
        ) : null}

        <SettingsDivider fullBleed />

        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }} aria-label="Callback">
          <SettingsSectionLabel>Callback</SettingsSectionLabel>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: item.callbackStatus === "failed" ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
            {REQUEST_CALLBACK_LABEL[item.callbackStatus]}
          </span>
          {item.callbackUrl ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", overflowWrap: "anywhere" }}>{item.callbackUrl}</span>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
