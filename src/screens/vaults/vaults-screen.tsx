import { useState } from "react";
import { useNavigate } from "react-router";
import { FolderOpen, AddCircle, Settings, CheckCircle } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { Identicon } from "@/components/identicon";
import { usePersistedStore, type VaultMeta, type VaultColor, type AccountMeta, type WalletIconId } from "@/store/persisted";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import { useSessionStore } from "@/store/session";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, type VaultData } from "@/lib/vault";
import { newId } from "@/lib/crypto";

import { parseSignedExportEnvelope } from "@/lib/export-format";
import { recordAuditEvent } from "@/lib/audit-log";
import { timeAgo } from "@/lib/format";


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
  interface ImportData {
    name: string;
    color: VaultColor;
    icon?: WalletIconId;
    accounts: AccountMeta[];
    vault: VaultData;
    formatVersion: number;
    signatureVerified: boolean;
    legacy: boolean;
  }
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importFileError, setImportFileError] = useState("");

  // ─── Actions ───

  function openActions(vault: VaultMeta) {
    setActionVault(vault);
  }

  function openSwitch(vault: VaultMeta) {
    setActionVault(null);
    setSwitchingVault(vault);
    setSwitchPassword("");
    setSwitchError("");
  }

  async function doSwitch() {
    if (!switchingVault) return;
    setSwitchLoading(true);
    setSwitchError("");
    try {
      const seeds = await unlockVault(switchingVault.encryptedData!, switchPassword);
      const wallets = await unlockSecureSession(seeds);
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
      await unlockVault(deletingVault.encryptedData!, deletePassword);
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
        const text = await file.text();
        const parsed = await parseSignedExportEnvelope<{
          glyph: number;
          name: string;
          color: VaultColor;
          icon?: WalletIconId;
          accounts: unknown[];
          vault: VaultData;
        }>(text, "vault");
        if (parsed.payload.glyph !== 1 || !parsed.payload.vault || !parsed.payload.name?.trim()) throw new Error();
        const rawAccounts: unknown[] = Array.isArray(parsed.payload.accounts) ? parsed.payload.accounts : [];
        const sanitizedAccounts: AccountMeta[] = rawAccounts
          .filter((a): a is Record<string, unknown> => a !== null && typeof a === "object" && !Array.isArray(a))
          .map((a, i) => ({
            index: typeof a.index === "number" && Number.isInteger(a.index) && a.index >= 0 ? a.index : i,
            name: typeof a.name === "string" && a.name.trim() ? a.name.trim().slice(0, 64) : `Account ${i + 1}`,
            addedAt: typeof a.addedAt === "number" && a.addedAt > 0 ? a.addedAt : Date.now(),
            hidden: a.hidden === true,
          }));
        setImportData({
          name: parsed.payload.name,
          color: parsed.payload.color ?? DEFAULT_WALLET_COLOR,
          icon: parsed.payload.icon ?? DEFAULT_WALLET_ICON,
          accounts: sanitizedAccounts,
          vault: parsed.payload.vault as VaultData,
          formatVersion: parsed.version,
          signatureVerified: parsed.verified,
          legacy: parsed.legacy,
        });
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
      await unlockVault(importData.vault, importPassword);
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

  const sorted = vaults.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));

  return (
    <AppShell contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <section aria-labelledby="vault-actions" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div id="vault-actions" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
          Vault management
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <Button size="sm" style={{ width: "auto" }} onClick={() => navigate("/setup/create")}>
          <AddCircle size={18} aria-hidden="true" />
          New vault
        </Button>
        <Button variant="secondary" size="sm" style={{ width: "auto" }} onClick={openImportPicker}>
          <FolderOpen size={18} aria-hidden="true" />
          Import vault
        </Button>
        </div>
      </section>
      <section aria-labelledby="vault-list" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-3)" }}>
        <div id="vault-list" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
          Vaults
        </div>
      {/* Vault list */}
      {sorted.map((vault) => {
        const isActive = vault.id === settings.activeVaultId;
        const visibleCount = vault.accounts.filter((a) => !a.hidden).length;

        return (
          <div
            key={vault.id}
            className={`stagger-item${recentlySwitchedId === vault.id ? " flash-success" : ""}`}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              background: isActive ? "var(--color-bg-elevated)" : "transparent",
              borderRadius: "var(--radius-card)",
              border: `1px solid ${isActive ? "var(--color-border-strong)" : "transparent"}`,
              boxShadow: "none",
              transition: "background 0.12s, border-color 0.12s, box-shadow 0.12s",
            }}
          >
            <button
              type="button"
              onClick={() => isActive ? navigate(`/vaults/${vault.id}`) : openSwitch(vault)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                background: "none", border: "none", cursor: "pointer",
                flex: 1, minWidth: 0, textAlign: "left", padding: 0,
              }}
            >
              <Identicon kind="vault" seed={`${vault.id}:${vault.color}`} label={vault.name} size={36} radius={10} style={{ flexShrink: 0 }} walletIcon={vault.icon} vaultColor={vault.color} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                    fontWeight: 600, color: "var(--color-text-display)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {vault.name}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                    color: "var(--color-accent)",
                    padding: "1px var(--space-1)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
                    borderRadius: "var(--radius-pill)",
                    lineHeight: "16px",
                    letterSpacing: "0.02em",
                  }}>
                    Standard
                  </span>
                </div>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                  color: "var(--color-text-disabled)",
                }}>
                  {visibleCount} {visibleCount === 1 ? "account" : "accounts"} · Unlocked {timeAgo(vault.lastUnlockedAt).toLowerCase()}
                </span>
              </div>
              {isActive && (
                <span aria-label="Selected vault" title="Selected vault" style={{ display: "inline-flex", color: "var(--color-accent)", flexShrink: 0 }}>
                  <CheckCircle size={18} weight="Outline" aria-hidden="true" />
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label="Vault options"
              onClick={() => openActions(vault)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-text-disabled)", padding: "var(--space-2)",
                flexShrink: 0, display: "flex", alignItems: "center",
              }}
            >
              <Settings size={16} weight="Linear" />
            </button>
          </div>
        );
      })}

      {vaults.length === 0 && (
        <div style={{
          textAlign: "center", padding: "var(--space-12) 0",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
          color: "var(--color-text-disabled)",
        }}>
          No vaults yet
        </div>
      )}
      </section>

      {/* ─── Action sheet ─── */}
      <Sheet open={!!actionVault} onClose={() => setActionVault(null)} title={actionVault?.name ?? ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {actionVault && actionVault.id === settings.activeVaultId && (
            <SheetAction onClick={() => { setActionVault(null); navigate(`/vaults/${actionVault.id}`); }}>
              Manage accounts
            </SheetAction>
          )}
          {actionVault && actionVault.id !== settings.activeVaultId && (
            <SheetAction onClick={() => openSwitch(actionVault)}>
              Switch to vault
            </SheetAction>
          )}
          <SheetAction onClick={() => openRename(actionVault!)}>
            Rename
          </SheetAction>
          <SheetAction danger onClick={() => openDelete(actionVault!)}>
            Delete vault
          </SheetAction>
        </div>
      </Sheet>

      {/* ─── Switch vault sheet ─── */}
      <Sheet open={!!switchingVault} onClose={() => setSwitchingVault(null)} title={`Unlock ${switchingVault?.name ?? ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            type="password"
            label="Password"
            value={switchPassword}
            onChange={(e) => { setSwitchPassword(e.target.value); setSwitchError(""); }}
            onKeyDown={(e) => e.key === "Enter" && !switchLoading && doSwitch()}
            error={switchError}
            placeholder="••••••••••"
            autoComplete="current-password"
            autoFocus
          />
          <Button onClick={doSwitch} loading={switchLoading}>Unlock</Button>
        </div>
      </Sheet>

      {/* ─── Rename sheet ─── */}
      <Sheet open={!!renamingVault} onClose={() => setRenamingVault(null)} title="Rename vault">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doRename()}
            placeholder="Vault name"
            autoFocus
          />
          <Button onClick={doRename} disabled={!renameValue.trim()}>Save</Button>
        </div>
      </Sheet>

      {/* ─── Delete sheet ─── */}
      <Sheet open={!!deletingVault} onClose={() => setDeletingVault(null)} title={`Delete ${deletingVault?.name ?? ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {(deletingVault?.accounts.length ?? 0) > 1 && (
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
              color: "var(--color-status-warning)",
            }}>
              This vault contains {deletingVault!.accounts.length} accounts. All seeds will be permanently lost.
            </span>
          )}
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
            color: "var(--color-text-secondary)",
          }}>
            This action cannot be undone.
          </span>
          <Input
            type="password"
            label="Password to confirm"
            value={deletePassword}
            onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(""); }}
            onKeyDown={(e) => e.key === "Enter" && !deleteLoading && doDelete()}
            error={deleteError}
            placeholder="••••••••••"
            autoComplete="current-password"
            autoFocus
          />
          <Button variant="danger" shape="sharp" onClick={doDelete} loading={deleteLoading}
            disabled={!deletePassword}>
            Delete vault
          </Button>
        </div>
      </Sheet>

      {/* ─── Import sheet ─── */}
      <Sheet open={!!importData} onClose={() => setImportData(null)} title={`Import ${importData?.name ?? ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
              color: "var(--color-text-disabled)",
            }}>
              {importData?.accounts.length ?? 0} {(importData?.accounts.length ?? 0) === 1 ? "account" : "accounts"}
            </span>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
              color: importData?.signatureVerified ? "var(--color-status-success)" : "var(--color-status-warning)",
            }}>
              {importData?.legacy ? "Legacy format v1" : importData?.signatureVerified ? "Signed export verified" : "Signature not verified"}
            </span>
          </div>
          <Input
            type="password"
            label="Vault password"
            value={importPassword}
            onChange={(e) => { setImportPassword(e.target.value); setImportError(""); }}
            onKeyDown={(e) => e.key === "Enter" && !importLoading && doImport()}
            error={importError}
            placeholder="••••••••••"
            autoComplete="current-password"
            autoFocus
          />
          <Button onClick={doImport} loading={importLoading} disabled={!importPassword}>Import vault</Button>
        </div>
      </Sheet>

      {/* ─── Import file error sheet ─── */}
      <Sheet open={!!importFileError} onClose={() => setImportFileError("")} title="Import failed">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
            color: "var(--color-text-secondary)",
          }}>
            {importFileError}
          </span>
          <Button onClick={() => setImportFileError("")}>OK</Button>
        </div>
      </Sheet>
    </AppShell>
  );
}

function SheetAction({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block", width: "100%", background: "none", border: "none",
        cursor: "pointer", textAlign: "left",
        padding: "12px var(--space-2)",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
        color: danger ? "var(--color-status-error)" : "var(--color-text-primary)",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      {children}
    </button>
  );
}
