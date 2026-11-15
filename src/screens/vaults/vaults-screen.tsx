import { useState } from "react";
import { useNavigate } from "react-router";
import { FolderOpenIcon, AddCircleIcon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { usePersistedStore, type VaultMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { unlockVaultSession, verifyVaultPassword } from "@/lib/vault";
import { newId } from "@/lib/crypto";
import { DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import { recordAuditEvent } from "@/lib/audit-log";
import { VaultList } from "./vault-list";
import {
  VaultActionSheet,
  SwitchVaultSheet,
  RenameVaultSheet,
  DeleteVaultSheet,
  ImportVaultSheet,
  ImportVaultErrorSheet,
} from "./vault-list-sheets";
import { parseVaultImportFile, type VaultImportData } from "./vault-import";

export default function VaultsScreen() {
  const navigate = useNavigate();

  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const addVault = usePersistedStore((s) => s.addVault);
  const updateVault = usePersistedStore((s) => s.updateVault);
  const removeVault = usePersistedStore((s) => s.removeVault);
  const touchVaultUnlocked = usePersistedStore((s) => s.touchVaultUnlocked);
  const unlock = useSessionStore((s) => s.unlock);
  const sessionLock = useSessionStore((s) => s.lock);
  const resetSessionForSetup = useSessionStore((s) => s.resetForSetup);

  // Action sheet
  const [actionVault, setActionVault] = useState<VaultMeta | null>(null);
  const [recentlySwitchedId, setRecentlySwitchedId] = useState<string | null>(null);

  // Switch
  const [switchingVault, setSwitchingVault] = useState<VaultMeta | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchError, setSwitchError] = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);

  // Rename
  const [renamingVault, setRenamingVault] = useState<VaultMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete
  const [deletingVault, setDeletingVault] = useState<VaultMeta | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Import
  const [importData, setImportData] = useState<VaultImportData | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importFileError, setImportFileError] = useState("");

  // ─── Actions ───

  function openActions(vault: VaultMeta) {
    if (switchLoading) return;
    setActionVault(vault);
  }

  function openSwitch(vault: VaultMeta) {
    if (switchLoading) return;
    setActionVault(null);
    setSwitchingVault(vault);
    setSwitchPassword("");
    setSwitchError("");
  }

  async function doSwitch() {
    if (!switchingVault || switchLoading) return;
    setSwitchLoading(true);
    setSwitchError("");
    try {
      const wallets = await unlockVaultSession(switchingVault.encryptedData!, switchPassword);
      unlock(switchingVault.id, wallets);
      setActiveVault(switchingVault.id);
      touchVaultUnlocked(switchingVault.id);
      setRecentlySwitchedId(switchingVault.id);
      recordAuditEvent({
        kind: "unlock_succeeded",
        status: "success",
        title: "Vault switched",
        detail: switchingVault.name,
        vaultId: switchingVault.id,
      });
      setSwitchingVault(null);
      navigate("/dashboard", { replace: true });
    } catch {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Vault switch failed",
        detail: switchingVault.name,
        vaultId: switchingVault.id,
      });
      setSwitchError("Wrong password");
    } finally {
      setSwitchLoading(false);
    }
  }

  function openRename(vault: VaultMeta) {
    setActionVault(null);
    setRenamingVault(vault);
    setRenameValue(vault.name);
  }

  function doRename() {
    if (!renamingVault || !renameValue.trim()) return;
    updateVault(renamingVault.id, { name: renameValue.trim() });
    setRecentlySwitchedId(renamingVault.id);
    setRenamingVault(null);
  }

  function openDelete(vault: VaultMeta) {
    setActionVault(null);
    setDeletingVault(vault);
    setDeletePassword("");
    setDeleteError("");
  }

  async function doDelete() {
    if (!deletingVault) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await verifyVaultPassword(deletingVault.encryptedData!, deletePassword);
      const wasActive = deletingVault.id === settings.activeVaultId;
      removeVault(deletingVault.id);
      const remaining = usePersistedStore.getState().vaults;
      if (remaining.length === 0) {
        setDeletingVault(null);
        resetSessionForSetup();
        navigate("/setup", { replace: true });
        return;
      }
      if (wasActive) {
        const next = remaining.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0))[0];
        setActiveVault(next.id);
        sessionLock();
        navigate("/lock", { replace: true });
        return;
      }
      setDeletingVault(null);
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
        setImportData(await parseVaultImportFile(await file.text()));
        setImportPassword("");
        setImportError("");
        setImportFileError("");
      } catch {
        setImportFileError("Invalid or unsupported vault file");
      }
    };
    input.click();
  }

  async function doImport() {
    if (!importData) return;
    setImportLoading(true);
    setImportError("");
    try {
      await verifyVaultPassword(importData.vault, importPassword);
      addVault({
        id: newId(),
        name: importData.name,
        color: importData.color,
        icon: importData.icon ?? DEFAULT_WALLET_ICON,
        kind: "seeded",
        createdAt: Date.now(),
        lastUnlockedAt: 0,
        accounts: importData.accounts,
        encryptedData: importData.vault,
      });
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
      <section aria-labelledby="vault-actions" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div id="vault-actions" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
          Vault management
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <Button size="sm" style={{ width: "auto" }} onClick={() => navigate("/setup/create")} disabled={switchLoading}>
          <AddCircleIcon size={18} aria-hidden="true" />
          New vault
        </Button>
        <Button variant="secondary" size="sm" style={{ width: "auto" }} onClick={openImportPicker} disabled={switchLoading}>
          <FolderOpenIcon size={18} aria-hidden="true" />
          Import vault
        </Button>
        </div>
      </section>
      <section aria-labelledby="vault-list" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-3)" }}>
        <div id="vault-list" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
          Vaults
        </div>
        <VaultList
          vaults={vaults}
          activeVaultId={settings.activeVaultId}
          switchLoading={switchLoading}
          switchingVaultId={switchingVault?.id ?? null}
          recentlySwitchedId={recentlySwitchedId}
          onSelect={(vault) => (vault.id === settings.activeVaultId ? navigate(`/vaults/${vault.id}`) : openSwitch(vault))}
          onOpenActions={openActions}
        />
      </section>

      <VaultActionSheet
        vault={actionVault}
        activeVaultId={settings.activeVaultId}
        onClose={() => setActionVault(null)}
        onManageAccounts={(vault) => { setActionVault(null); navigate(`/vaults/${vault.id}`); }}
        onSwitch={openSwitch}
        onRename={openRename}
        onDelete={openDelete}
      />

      <SwitchVaultSheet
        vault={switchingVault}
        password={switchPassword}
        onPasswordChange={(value) => { setSwitchPassword(value); setSwitchError(""); }}
        error={switchError}
        loading={switchLoading}
        onClose={() => setSwitchingVault(null)}
        onSwitch={doSwitch}
      />

      <RenameVaultSheet
        vault={renamingVault}
        value={renameValue}
        onChange={setRenameValue}
        onClose={() => setRenamingVault(null)}
        onSave={doRename}
      />

      <DeleteVaultSheet
        vault={deletingVault}
        password={deletePassword}
        onPasswordChange={(value) => { setDeletePassword(value); setDeleteError(""); }}
        error={deleteError}
        loading={deleteLoading}
        onClose={() => setDeletingVault(null)}
        onDelete={doDelete}
      />

      <ImportVaultSheet
        data={importData}
        password={importPassword}
        onPasswordChange={(value) => { setImportPassword(value); setImportError(""); }}
        error={importError}
        loading={importLoading}
        onClose={() => setImportData(null)}
        onImport={doImport}
      />

      <ImportVaultErrorSheet error={importFileError} onClose={() => setImportFileError("")} />
    </AppShell>
  );
}
