import { SettingsDivider } from "@/components/settings-section-elements";
import { dappPolicySummary } from "@/components/dapp-policy-controls";
import { formatDate } from "@/lib/format";
import type { ApprovedDapp } from "@/store/persisted";
import { ChevronIcon, GlobeIcon, SlashIcon } from "./dapp-icons";
import { DappLimits } from "./dapp-limits";
import { DappPermissions } from "./dapp-permissions";
import { DappSharedAccounts } from "./dapp-shared-accounts";
import { SmallActionButton } from "./small-action-button";

/** Expandable row describing one approved dApp and its editable scopes. */
export function DappListItem({
  dapp,
  divided,
  identityLabel,
  onRemoveIdentity,
  onRemovePermission,
  onPolicyChange,
  onRevoke,
}: {
  dapp: ApprovedDapp;
  divided: boolean;
  identityLabel: (identity: string) => string;
  onRemoveIdentity: (identity: string) => void;
  onRemovePermission: (permission: ApprovedDapp["permissions"][number]) => void;
  onPolicyChange: (policy: Pick<ApprovedDapp, "transferLimitQu" | "expiryDurationMs" | "expiresAt">) => void;
  onRevoke: () => void;
}) {
  const accountCount = dapp.allowedIdentities?.length;
  const accountSummary = accountCount ? `${accountCount} shared ${accountCount === 1 ? "account" : "accounts"}` : "All accounts";
  const permissionSummary = dapp.permissions.length === 0
    ? "No extra permissions"
    : `${dapp.permissions.length} ${dapp.permissions.length === 1 ? "permission" : "permissions"}`;
  const policySummary = dappPolicySummary(dapp);
  const hasTransferLikePermission = dapp.permissions.some((permission) => permission === "transfer" || permission === "sc_call");
  const policyIdPrefix = `dapp-policy-${encodeURIComponent(dapp.origin).replace(/%/g, "")}`;

  return (
    <div>
      {divided && <SettingsDivider />}
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
                <span>{policySummary}</span>
                <span>Approved {formatDate(dapp.approvedAt)}</span>
                {dapp.lastUsedAt && <span>Last used {formatDate(dapp.lastUsedAt)}</span>}
              </div>
            </div>
          </div>
        </summary>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-4)", paddingLeft: "calc(16px + var(--space-3))" }}>
          <DappSharedAccounts
            dappName={dapp.name}
            identities={dapp.allowedIdentities}
            identityLabel={identityLabel}
            onRemove={onRemoveIdentity}
          />

          <DappPermissions
            dappName={dapp.name}
            permissions={dapp.permissions}
            onRemove={onRemovePermission}
          />

          <DappLimits
            dapp={dapp}
            hasTransferLikePermission={hasTransferLikePermission}
            policyIdPrefix={policyIdPrefix}
            onPolicyChange={onPolicyChange}
          />

          <div style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <SmallActionButton ariaLabel={`Revoke ${dapp.name}`} onClick={onRevoke}>
              <SlashIcon />
              Revoke access
            </SmallActionButton>
          </div>
        </div>
      </details>
    </div>
  );
}
