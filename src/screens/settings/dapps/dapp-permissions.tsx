import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import type { ApprovedDapp } from "@/store/persisted";
import { ShieldIcon } from "./dapp-icons";
import { SmallActionButton } from "./small-action-button";

const PERMISSION_LABELS: Record<string, string> = {
  transfer: "Transfer",
  sc_call: "Contract calls",
  sign_message: "Sign messages",
};

/** Granted permissions for a dApp, with per-permission removal. */
export function DappPermissions({
  dappName,
  permissions,
  onRemove,
}: {
  dappName: string;
  permissions: ApprovedDapp["permissions"];
  onRemove: (permission: ApprovedDapp["permissions"][number]) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <SettingsSectionLabel>Permissions</SettingsSectionLabel>
      {permissions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {permissions.map((permission, index) => (
            <div key={permission}>
              {index > 0 && <SettingsDivider />}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 44 }}>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                  <span style={{ color: "var(--color-text-tertiary)" }}><ShieldIcon /></span>
                  {PERMISSION_LABELS[permission] ?? permission}
                </span>
                <SmallActionButton
                  ariaLabel={`Remove ${PERMISSION_LABELS[permission] ?? permission} permission from ${dappName}`}
                  onClick={() => onRemove(permission)}
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
  );
}
