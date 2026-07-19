import { useNavigate } from "react-router-dom";
import { Identicon } from "@/components/identicon";
import { ScreenHeader } from "@/components/screen-header";
import { usePersistedStore } from "@/store/persisted";

/**
 * Inline header for settings subpages.
 * The slot-based header is hidden for /settings/* routes by showChrome,
 * so each subpage renders its own header inline.
 */
export function SettingsPageHeader({ title, backTo = "/settings" }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  const activeVault = usePersistedStore((s) => s.vaults.find((vault) => vault.id === s.settings.activeVaultId) ?? s.vaults[0] ?? null);

  return (
    <ScreenHeader
      title={title}
      eyebrow={activeVault?.name ?? undefined}
      leading={activeVault ? <Identicon seed={`${activeVault.id}:${activeVault.color}`} size={28} radius={8} /> : null}
      onBack={() => navigate(backTo)}
      backAriaLabel={backTo === "/settings" ? "Back to settings" : "Go back"}
    />
  );
}
