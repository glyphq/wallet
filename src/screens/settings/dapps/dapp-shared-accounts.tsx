import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { UserIcon } from "./dapp-icons";
import { SmallActionButton } from "./small-action-button";

/** Account identities a dApp may act for, with per-identity removal. */
export function DappSharedAccounts({
  dappName,
  identities,
  identityLabel,
  onRemove,
}: {
  dappName: string;
  identities: string[] | undefined;
  identityLabel: (identity: string) => string;
  onRemove: (identity: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <SettingsSectionLabel>Shared accounts</SettingsSectionLabel>
      {identities && identities.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {identities.map((identity, index) => {
            const label = identityLabel(identity);

            return (
              <div key={identity}>
                {index > 0 && <SettingsDivider />}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 44 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", minWidth: 0 }}>
                    <span style={{ color: "var(--color-text-tertiary)" }}><UserIcon /></span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  </span>
                  <SmallActionButton
                    ariaLabel={`Remove ${label} from ${dappName}`}
                    onClick={() => onRemove(identity)}
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
  );
}
