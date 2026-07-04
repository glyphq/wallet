import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Eye, AddCircle, Settings } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { Identicon } from "@/components/identicon";
import { usePersistedStore, type VaultMeta, type VaultColor, type AccountMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, type VaultData } from "@/lib/vault";
import { isValidIdentity, newId } from "@/lib/crypto";
import { isWatchOnlyVault, parseAccountTags } from "@/lib/accounts";
import { parseSignedExportEnvelope } from "@/lib/export-format";
import { recordAuditEvent } from "@/lib/audit-log";

function timeAgo(ms: number): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

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

  // Watch-only
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchName, setWatchName] = useState("");
  const [watchInput, setWatchInput] = useState("");
  const [watchError, setWatchError] = useState("");

  // Import
  interface ImportData {
    name: string;
    color: VaultColor;
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
    if (isWatchOnlyVault(vault)) {
      doWatchOnlySwitch(vault);
      return;
    }
    setSwitchingVault(vault);
    setSwitchPassword("");
    setSwitchError("");
  }

  function doWatchOnlySwitch(vault: VaultMeta) {
    unlock(vault.id, [], {
      watchOnly: true,
      identities: vault.accounts.map((a) => a.identity).filter((id): id is string => !!id),
    });
    setActiveVault(vault.id);
    touchVaultUnlocked(vault.id);
    navigate("/dashboard", { replace: true });
  }

  async function doSwitch() {
    if (!switchingVault) return;
    setSwitchLoading(true);
    setSwitchError("");
    try {
      const seeds = await unlockVault(switchingVault.encryptedData!, switchPassword);
      const wallets = unlockSecureSession(seeds);
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
      if (!isWatchOnlyVault(deletingVault)) {
        await unlockVault(deletingVault.encryptedData!, deletePassword);
      }
      const wasActive = deletingVault.id === settings.activeVaultId;
      removeVault(deletingVault.id);
      const remaining = usePersistedStore.getState().vaults;
      if (remaining.length === 0) {
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
          color: parsed.payload.color ?? "slate",
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

  // ─── Watch-only ───

  function createWatchOnlyVault() {
    const name = watchName.trim();
    if (!name) { setWatchError("Name required"); return; }
    const accounts = watchInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [identityPart, ...labelParts] = line.split(",");
        const identity = identityPart?.trim().toUpperCase() ?? "";
        return {
          index,
          name: labelParts.join(",").trim() || `Account ${index + 1}`,
          addedAt: Date.now(),
          hidden: false,
          identity,
          note: "",
          tags: parseAccountTags("watch-only"),
        };
      });
    if (accounts.length === 0) { setWatchError("Add at least one identity"); return; }
    if (accounts.some((a) => !a.identity || !isValidIdentity(a.identity))) { setWatchError("Invalid identity in list"); return; }
    addVault({
      id: newId(),
      name,
      color: "slate",
      kind: "watch_only",
      createdAt: Date.now(),
      lastUnlockedAt: Date.now(),
      accounts,
      encryptedData: null,
    });
    setWatchOpen(false);
    setWatchName("");
    setWatchInput("");
    setWatchError("");
  }

  // ─── Render ───

  const sorted = vaults.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));

  return (
    <AppShell
      statusBar={
        <ScreenHeader
          title="Vaults"
          onBack={() => navigate("/dashboard")}
          action={
            <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
              <button type="button" onClick={openImportPicker} aria-label="Import vault" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2)", display: "flex", alignItems: "center" }}>
                <FolderOpen size={15} weight="Linear" />
              </button>
              <button type="button" onClick={() => setWatchOpen(true)} aria-label="Watch-only vault" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2)", display: "flex", alignItems: "center" }}>
                <Eye size={15} weight="Linear" />
              </button>
              <button type="button" onClick={() => navigate("/setup/create")} aria-label="New vault" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2)", display: "flex", alignItems: "center" }}>
                <AddCircle size={15} weight="Linear" />
              </button>
            </div>
          }
        />
      }
      contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
    >
      {/* Vault list */}
      {sorted.map((vault) => {
        const isActive = vault.id === settings.activeVaultId;
        const watchOnly = isWatchOnlyVault(vault);
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
              transition: "background 0.12s, border-color 0.12s",
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
              <Identicon seed={`${vault.id}:${vault.color}`} size={36} radius={8} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                    fontWeight: 500, color: "var(--color-text-display)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {vault.name}
                  </span>
                  {watchOnly && (
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                      color: "var(--color-text-disabled)",
                      padding: "1px var(--space-1)",
                      border: "1px solid var(--color-border-strong)",
                      borderRadius: "var(--radius-pill)",
                      lineHeight: "16px",
                    }}>
                      Watch
                    </span>
                  )}
                </div>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                  color: "var(--color-text-disabled)",
                }}>
                  {visibleCount} {visibleCount === 1 ? "account" : "accounts"} · {watchOnly ? "Read-only" : `Unlocked ${timeAgo(vault.lastUnlockedAt).toLowerCase()}`}
                </span>
              </div>
              {isActive && (
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: "var(--color-accent)",
                }} />
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
              {isWatchOnlyVault(actionVault) ? "Open vault" : "Switch to vault"}
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
          {!isWatchOnlyVault(deletingVault) && (deletingVault?.accounts.length ?? 0) > 1 && (
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
            {isWatchOnlyVault(deletingVault)
              ? "Watch-only vaults don't contain seeds. This only removes local tracking."
              : "This action cannot be undone."}
          </span>
          {!isWatchOnlyVault(deletingVault) && (
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
          )}
          <Button variant="danger" shape="sharp" onClick={doDelete} loading={deleteLoading}
            disabled={!isWatchOnlyVault(deletingVault) && !deletePassword}>
            Delete vault
          </Button>
        </div>
      </Sheet>

      {/* ─── Watch-only sheet ─── */}
      <Sheet open={watchOpen} onClose={() => setWatchOpen(false)} title="Watch-only vault">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
            One identity per line. Optional label after a comma.
          </span>
          <Input
            label="Vault name"
            value={watchName}
            onChange={(e) => { setWatchName(e.target.value); setWatchError(""); }}
            placeholder="e.g. Treasury, Validators"
            autoFocus
          />
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              fontWeight: 500, color: "var(--color-text-secondary)",
              letterSpacing: "0.05em",
            }}>
              Identities
            </span>
            <textarea
              value={watchInput}
              onChange={(e) => { setWatchInput(e.target.value); setWatchError(""); }}
              rows={5}
              placeholder={"IDENTITYONE..., Main\nIDENTITYTWO..., Cold staking"}
              style={{
                width: "100%", resize: "vertical",
                background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)",
                padding: "var(--space-3)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
              }}
            />
          </label>
          {watchError && (
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
              color: "var(--color-status-error)",
            }}>
              {watchError}
            </span>
          )}
          <Button onClick={createWatchOnlyVault}>Create</Button>
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
