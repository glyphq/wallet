import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { Identicon } from "@/components/identicon";
import { usePersistedStore } from "@/store/persisted";

export function ShellWalletSwitcher() {
  const navigate = useNavigate();
  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);

  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === settings.activeWalletId) ?? wallets[0] ?? null,
    [settings.activeWalletId, wallets],
  );

  if (!activeWallet) return null;

  return (
    <button
      type="button"
      aria-label={`Switch wallet. Current wallet: ${activeWallet.name}`}
      onClick={() => navigate("/wallets/switch")}
      className="glyph-avatar-btn corner-frame"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        padding: 0,
        borderRadius: "var(--radius-sharp)",
        boxShadow: "none",
        "--corner-size": "6px",
        "--corner-inset": "2px",
        cursor: "pointer",
      } as CSSProperties}
    >
      <Identicon kind="wallet" seed={`${activeWallet.id}:${activeWallet.color}`} label={activeWallet.name} size={32} />
    </button>
  );
}
