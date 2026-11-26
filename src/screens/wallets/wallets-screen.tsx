import { useState } from "react";
import { useNavigate } from "react-router";
import { FolderOpenIcon, AddCircleIcon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { usePersistedStore, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { verifyWalletPassword } from "@/lib/wallet";
import { newId } from "@/lib/crypto";
import { WalletList } from "./wallet-list";
import {
  WalletActionScreen,
  RenameWalletScreen,
  DeleteWalletScreen,
  ImportWalletScreen,
  ImportWalletErrorScreen,
} from "./wallet-list-screens";
import { parseWalletImportFile, restoreImportedWalletExtras, type WalletImportData } from "./wallet-import";

export default function WalletsScreen() {
  const navigate = useNavigate();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveWallet = usePersistedStore((s) => s.setActiveWallet);
  const addWallet = usePersistedStore((s) => s.addWallet);
  const updateWallet = usePersistedStore((s) => s.updateWallet);
  const removeWallet = usePersistedStore((s) => s.removeWallet);
  const sessionLock = useSessionStore((s) => s.lock);
  const resetSessionForSetup = useSessionStore((s) => s.resetForSetup);

  // Action screen
  const [actionWallet, setActionWallet] = useState<WalletMeta | null>(null);

  // Rename
  const [renamingWallet, setRenamingWallet] = useState<WalletMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete
  const [deletingWallet, setDeletingWallet] = useState<WalletMeta | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Import
  const [importData, setImportData] = useState<WalletImportData | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importFileError, setImportFileError] = useState("");

  // ─── Actions ───

  function openActions(wallet: WalletMeta) {
    setActionWallet(wallet);
  }

  function openRename(wallet: WalletMeta) {
    setActionWallet(null);
    setRenamingWallet(wallet);
    setRenameValue(wallet.name);
  }

  function doRename() {
    if (!renamingWallet || !renameValue.trim()) return;
    updateWallet(renamingWallet.id, { name: renameValue.trim() });
    setRenamingWallet(null);
  }

  function openDelete(wallet: WalletMeta) {
    setActionWallet(null);
    setDeletingWallet(wallet);
    setDeletePassword("");
    setDeleteError("");
  }

  async function doDelete() {
    if (!deletingWallet) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await verifyWalletPassword(deletingWallet.encryptedData!, deletePassword);
      const wasActive = deletingWallet.id === settings.activeWalletId;
      removeWallet(deletingWallet.id);
      const remaining = usePersistedStore.getState().wallets;
      if (remaining.length === 0) {
        setDeletingWallet(null);
        resetSessionForSetup();
        navigate("/setup", { replace: true });
        return;
      }
      if (wasActive) {
        const next = remaining.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0))[0];
        setActiveWallet(next.id);
        sessionLock();
        navigate("/lock", { replace: true });
        return;
      }
      setDeletingWallet(null);
    } catch {
      setDeleteError("Wrong password");
    } finally {
      setDeleteLoading(false);
    }
  }

  // ─── Import ───

  function openImportPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setImportData(await parseWalletImportFile(await file.text()));
        setImportPassword("");
        setImportError("");
        setImportFileError("");
      } catch {
        setImportFileError("Invalid or unsupported wallet backup");
      }
    };
    input.click();
  }

  async function doImport() {
    if (!importData) return;
    setImportLoading(true);
    setImportError("");
    try {
      await verifyWalletPassword(importData.wallet, importPassword);
      addWallet({
        id: newId(),
        name: importData.name,
        color: importData.color,
        icon: importData.icon,
        kind: "seeded",
        createdAt: Date.now(),
        lastUnlockedAt: 0,
        accounts: importData.accounts,
        encryptedData: importData.wallet,
      });
      restoreImportedWalletExtras(importData);
      setImportData(null);
    } catch {
      setImportError("Wrong password");
    } finally {
      setImportLoading(false);
    }
  }

  // ─── Render ───

  return (
    <AppShell contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <section aria-labelledby="wallet-actions" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div id="wallet-actions" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
          Wallet management
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <Button size="sm" style={{ width: "auto" }} onClick={() => navigate("/setup/create")}>
          <AddCircleIcon size={18} aria-hidden="true" />
          New wallet
        </Button>
        <Button variant="secondary" size="sm" style={{ width: "auto" }} onClick={openImportPicker}>
          <FolderOpenIcon size={18} aria-hidden="true" />
          Import wallet
        </Button>
        </div>
      </section>
      <section aria-labelledby="wallet-list" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-3)" }}>
        <div id="wallet-list" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
          Wallets
        </div>
        <WalletList
          wallets={wallets}
          activeWalletId={settings.activeWalletId}
          onSelect={(wallet) => navigate(`/wallets/${wallet.id}`)}
          onOpenActions={openActions}
        />
      </section>

      <WalletActionScreen
        wallet={actionWallet}
        activeWalletId={settings.activeWalletId}
        onClose={() => setActionWallet(null)}
        onManageAccounts={(wallet) => { setActionWallet(null); navigate(`/wallets/${wallet.id}`); }}
        onRename={openRename}
        onDelete={openDelete}
      />

      <RenameWalletScreen
        wallet={renamingWallet}
        value={renameValue}
        onChange={setRenameValue}
        onClose={() => setRenamingWallet(null)}
        onSave={doRename}
      />

      <DeleteWalletScreen
        wallet={deletingWallet}
        password={deletePassword}
        onPasswordChange={(value) => { setDeletePassword(value); setDeleteError(""); }}
        error={deleteError}
        loading={deleteLoading}
        onClose={() => setDeletingWallet(null)}
        onDelete={doDelete}
      />

      <ImportWalletScreen
        data={importData}
        password={importPassword}
        onPasswordChange={(value) => { setImportPassword(value); setImportError(""); }}
        error={importError}
        loading={importLoading}
        onClose={() => setImportData(null)}
        onImport={doImport}
      />

      <ImportWalletErrorScreen error={importFileError} onClose={() => setImportFileError("")} />
    </AppShell>
  );
}
