import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type AccountMeta } from "@/store/persisted";
import { MAX_VAULT_ACCOUNTS, useVaultBalances } from "@/hooks/use-vault-balances";
import { useSessionStore } from "@/store/session";
import { deriveIdentityFromSeed, generateRandomSeed, isValidIdentity, toSeed, InvalidSeedError, type Seed } from "@/lib/crypto";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, addToVault, removeFromVault, exportVault, createVault } from "@/lib/vault";
import { IdentityDisplay } from "@/components/identity-display";
import { Identicon } from "@/components/identicon";
import { saveFileDialog } from "@/lib/save-file";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { getAccountIdentity, isWatchOnlyVault, parseAccountTags } from "@/lib/accounts";
import { createSignedExportEnvelope } from "@/lib/export-format";
import { recordAuditEvent } from "@/lib/audit-log";
import { formatQu } from "@/lib/format";
import {
  Pen2, DocumentText, Key, EyeClosed, Eye, TrashBinMinimalistic,
  AddCircle, InfoCircle,
} from "@solar-icons/react";

const ACCOUNT_NAME_SUGGESTIONS = [
  "Main", "Trading", "Staking", "Cold Storage", "DeFi", "Savings",
  "Hot Wallet", "Treasury", "Operations", "Rewards",
];

const VAULT_COLOR_CSS: Record<string, string> = {
  slate: "var(--color-vault-slate)",
  red: "var(--color-vault-red)",
  amber: "var(--color-vault-amber)",
  emerald: "var(--color-vault-emerald)",
  sky: "var(--color-vault-sky)",
  violet: "var(--color-vault-violet)",
};

export default function VaultDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const updateVault = usePersistedStore((s) => s.updateVault);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const sessionUnlock = useSessionStore((s) => s.unlock);
  const sessionWallets = useSessionStore((s) => s.wallets);

  const vault = vaults.find((v) => v.id === id);
  const isActive = vault?.id === settings.activeVaultId;

  const [addingAccount, setAddingAccount] = useState(false);
  const [newlyAddedIndex, setNewlyAddedIndex] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<"new" | "import">("new");
  const [addName, setAddName] = useState("");
  const [addIdentity, setAddIdentity] = useState("");
  const [addSeed, setAddSeed] = useState("");
  const [addSeedError, setAddSeedError] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [renamingAccount, setRenamingAccount] = useState<AccountMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMeta, setEditingMeta] = useState<AccountMeta | null>(null);
  const [metaNote, setMetaNote] = useState("");
  const [metaTags, setMetaTags] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountMeta | null>(null);

  const [removingAccount, setRemovingAccount] = useState<AccountMeta | null>(null);
  const [removePassword, setRemovePassword] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  const [showHidden, setShowHidden] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showRotate, setShowRotate] = useState(false);
  const [rotateOldPassword, setRotateOldPassword] = useState("");
  const [rotateNewPassword, setRotateNewPassword] = useState("");
  const [rotateConfirm, setRotateConfirm] = useState("");
  const [rotateError, setRotateError] = useState("");
  const [rotateLoading, setRotateLoading] = useState(false);
  const [rotateDone, setRotateDone] = useState(false);
  const [hidingAccount, setHidingAccount] = useState<AccountMeta | null>(null);
  const [revealingAccount, setRevealingAccount] = useState<AccountMeta | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealError, setRevealError] = useState("");
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealedSeed, setRevealedSeed] = useState("");
  const [seedCopied, setSeedCopied] = useState(false);
  const [seedSecsLeft, setSeedSecsLeft] = useState(0);
  const seedCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const biometricVaultIds = usePersistedStore((s) => s.settings.biometricVaultIds) ?? [];
  const requireBiometricForSeedReveal = usePersistedStore((s) => s.settings.requireBiometricForSeedReveal);
  const { data: vaultBalances } = useVaultBalances();

  useEffect(() => {
    if (!revealedSeed) return;
    setSeedSecsLeft(SEED_CLIPBOARD_CLEAR_SECS);
    const dismiss = setTimeout(() => {
      setRevealedSeed("");
      setSeedCopied(false);
      setRevealingAccount(null);
      setRevealPassword("");
    }, SEED_CLIPBOARD_CLEAR_SECS * 1000);
    seedCountdownRef.current = setInterval(() => {
      setSeedSecsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      clearTimeout(dismiss);
      if (seedCountdownRef.current) clearInterval(seedCountdownRef.current);
    };
  }, [revealedSeed]);

  if (!vault) return null;
  const currentVault = vault;
  const watchOnly = isWatchOnlyVault(currentVault);

  async function doExport() {
    if (!currentVault.encryptedData) return;
    const envelope = await createSignedExportEnvelope("vault", {
      glyph: 1,
      name: currentVault.name,
      color: currentVault.color,
      accounts: currentVault.accounts,
      exported_at: Date.now(),
      vault: JSON.parse(exportVault(currentVault.encryptedData)),
    });
    const data = JSON.stringify(envelope, null, 2);
    const defaultName = `glyph-${currentVault.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vault"}.json`;
    const saved = await saveFileDialog(defaultName, data);
    if (saved) {
      recordAuditEvent({
        kind: "vault_exported",
        status: "success",
        title: "Vault exported",
        detail: `${currentVault.name} saved as signed export v2`,
        vaultId: currentVault.id,
      });
      setShowExport(false);
    }
  }

  const visible = currentVault.accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index);
  const hidden = currentVault.accounts.filter((a) => a.hidden).sort((a, b) => a.index - b.index);
  const accentColor = VAULT_COLOR_CSS[currentVault.color] ?? "var(--color-text-secondary)";

  function openAccountMenu(account: AccountMeta) {
    setSelectedAccount(account);
  }

  function closeAccountMenu() {
    setSelectedAccount(null);
  }

  function openAdd() {
    setAddMode(watchOnly ? "import" : "new");
    setAddName("");
    setAddIdentity("");
    setAddSeed("");
    setAddSeedError("");
    setAddPassword("");
    setAddError("");
    setAddingAccount(true);
  }

  async function doAdd() {
    if (!addName.trim()) return;
    setAddSeedError("");
    setAddError("");

    if (watchOnly) {
      const identity = addIdentity.trim().toUpperCase();
      if (!isValidIdentity(identity)) {
        setAddError("Invalid identity");
        return;
      }
        const newAccount: AccountMeta = {
        index: currentVault.accounts.length,
        name: addName.trim(),
        addedAt: Date.now(),
        hidden: false,
        identity,
        note: "",
        tags: parseAccountTags("watch-only"),
      };
      updateVault(currentVault.id, { accounts: [...currentVault.accounts, newAccount] });
      setNewlyAddedIndex(currentVault.accounts.length);
      setAddingAccount(false);
      return;
    }

    let seedToAdd: Seed | null = null;
    if (addMode === "import") {
      try {
        seedToAdd = toSeed(addSeed.trim().toLowerCase());
      } catch (e) {
        setAddSeedError(e instanceof InvalidSeedError ? "55 lowercase letters required" : "Invalid seed");
        return;
      }
    }

    setAddLoading(true);
    try {
      const newSeed = seedToAdd ?? generateRandomSeed();
      const newEncrypted = await addToVault(currentVault.encryptedData!, addPassword, newSeed);
      const newIndex = currentVault.accounts.length;
      const newAccount: AccountMeta = {
        index: newIndex,
        name: addName.trim(),
        addedAt: Date.now(),
        hidden: false,
        identity: deriveIdentityFromSeed(newSeed),
        note: "",
        tags: [],
      };
      updateVault(currentVault.id, {
        encryptedData: newEncrypted,
        accounts: [...currentVault.accounts, newAccount],
      });
      if (isActive) {
        const allSeeds = await unlockVault(newEncrypted, addPassword);
        sessionUnlock(currentVault.id, unlockSecureSession(allSeeds));
      }
      setNewlyAddedIndex(newIndex);
      setAddingAccount(false);
    } catch {
      setAddError("Wrong password");
    } finally {
      setAddLoading(false);
    }
  }

  function doRename() {
    if (!renamingAccount || !renameValue.trim()) return;
    updateVault(currentVault.id, {
      accounts: currentVault.accounts.map((a) =>
        a.index === renamingAccount.index ? { ...a, name: renameValue.trim() } : a,
      ),
    });
    setRenamingAccount(null);
  }

  function saveAccountMeta() {
    if (!editingMeta) return;
    updateVault(currentVault.id, {
      accounts: currentVault.accounts.map((account) =>
        account.index === editingMeta.index
          ? { ...account, note: metaNote.trim(), tags: parseAccountTags(metaTags) }
          : account,
      ),
    });
    setEditingMeta(null);
  }

  function toggleHide(account: AccountMeta) {
    if (!account.hidden) {
      setHidingAccount(account);
      return;
    }
    updateVault(currentVault.id, {
      accounts: currentVault.accounts.map((a) =>
        a.index === account.index ? { ...a, hidden: false } : a,
      ),
    });
  }

  function confirmHide() {
    if (!hidingAccount) return;
    updateVault(currentVault.id, {
      accounts: currentVault.accounts.map((a) =>
        a.index === hidingAccount.index ? { ...a, hidden: true } : a,
      ),
    });
    setHidingAccount(null);
  }

  async function doRemove() {
    if (!removingAccount) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      if (watchOnly) {
        const updatedAccounts = currentVault.accounts
          .filter((a) => a.index !== removingAccount.index)
          .map((a) => ({ ...a, index: a.index > removingAccount.index ? a.index - 1 : a.index }));
        updateVault(currentVault.id, { accounts: updatedAccounts });
        if (isActive) {
          const activeIdx = settings.activeAccountIndex;
          if (removingAccount.index === activeIdx) {
            setActiveAccountIndex(0);
          } else if (removingAccount.index < activeIdx) {
            setActiveAccountIndex(activeIdx - 1);
          }
        }
        setRemovingAccount(null);
        return;
      }
      const newEncrypted = await removeFromVault(currentVault.encryptedData!, removePassword, removingAccount.index);
      const updatedAccounts = currentVault.accounts
        .filter((a) => a.index !== removingAccount.index)
        .map((a) => ({ ...a, index: a.index > removingAccount.index ? a.index - 1 : a.index }));
      updateVault(currentVault.id, { encryptedData: newEncrypted, accounts: updatedAccounts });
      if (isActive) {
        const remaining = await unlockVault(newEncrypted, removePassword);
        sessionUnlock(currentVault.id, unlockSecureSession(remaining));
        const activeIdx = settings.activeAccountIndex;
        if (removingAccount.index === activeIdx) {
          setActiveAccountIndex(0);
        } else if (removingAccount.index < activeIdx) {
          setActiveAccountIndex(activeIdx - 1);
        }
      }
      setRemovingAccount(null);
    } catch {
      setRemoveError("Wrong password");
    } finally {
      setRemoveLoading(false);
    }
  }

  async function doRotatePassword() {
    if (!rotateOldPassword || !rotateNewPassword) return;
    if (rotateNewPassword !== rotateConfirm) { setRotateError("Passwords do not match"); return; }
    if (rotateNewPassword.length < 8) { setRotateError("Password too short (min 8 chars)"); return; }
    setRotateLoading(true);
    setRotateError("");
    try {
      const seeds = await unlockVault(currentVault.encryptedData!, rotateOldPassword);
      const newEncrypted = await createVault(rotateNewPassword, seeds);
      updateVault(currentVault.id, { encryptedData: newEncrypted });
      if (isActive) {
        const wallets = unlockSecureSession(seeds);
        sessionUnlock(currentVault.id, wallets);
      }
      setRotateDone(true);
      setRotateOldPassword("");
      setRotateNewPassword("");
      setRotateConfirm("");
    } catch {
      setRotateError("Wrong password");
    } finally {
      setRotateLoading(false);
    }
  }

  function openReveal(account: AccountMeta) {
    setRevealingAccount(account);
    setRevealPassword("");
    setRevealError("");
    setRevealLoading(false);
    setRevealedSeed("");
    setSeedCopied(false);
  }

  async function doRevealSeed() {
    if (!revealingAccount) return;
    if (watchOnly) return;
    setRevealLoading(true);
    setRevealError("");
    try {
      let seeds;
      if (requireBiometricForSeedReveal) {
        const bioEnabled = biometricVaultIds.includes(currentVault.id);
        if (!bioEnabled) {
          setRevealError("Enable biometric for this vault first");
          setRevealLoading(false);
          return;
        }
        const { invoke } = await import("@tauri-apps/api/core");
        seeds = (await invoke<string[]>("biometric_unlock", {
          vaultId: currentVault.id,
          vaultData: currentVault.encryptedData!,
        })).map(toSeed);
      } else {
        seeds = await unlockVault(currentVault.encryptedData!, revealPassword);
      }
      const seed = seeds[revealingAccount.index];
      if (!seed) throw new Error("Missing seed");
      setRevealedSeed(seed);
      setRevealPassword("");
      recordAuditEvent({
        kind: "seed_revealed",
        status: "success",
        title: "Seed revealed",
        detail: `${revealingAccount.name} in ${currentVault.name}`,
        vaultId: currentVault.id,
        accountIndex: revealingAccount.index,
      });
    } catch {
      setRevealError("Wrong password");
    } finally {
      setRevealLoading(false);
    }
  }

  async function copyRevealedSeed() {
    if (!revealedSeed) return;
    await copyToClipboard(revealedSeed, SEED_CLIPBOARD_CLEAR_SECS);
    setSeedCopied(true);
  }

  const statusBar = (
    <ScreenHeader
      title={currentVault.name}
      onBack={() => navigate("/vaults")}
      action={
        currentVault.accounts.length < MAX_VAULT_ACCOUNTS
          ? <button type="button" onClick={openAdd} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "var(--space-1)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0 }}>
              <AddCircle size={15} weight="Linear" />
            </button>
          : <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>16 MAX</span>
      }
    />
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {visible.length === 0 && hidden.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
            No accounts in this vault
          </div>
          <Button variant="secondary" shape="sharp" size="sm" style={{ width: "auto" }} onClick={openAdd}>
            Add your first account
          </Button>
        </div>
      )}

      {visible.map((account) => (
        <AccountRow
          key={account.index}
          account={account}
          accentColor={accentColor}
          identity={getAccountIdentity(account, isActive ? (sessionWallets[account.index] ?? null) : null)}
          isCurrent={isActive && settings.activeAccountIndex === account.index}
          flashSuccess={newlyAddedIndex === account.index}
          balance={isActive && vaultBalances ? vaultBalances[getAccountIdentity(account, sessionWallets[account.index] ?? null) ?? ""] ?? null : null}
          onManage={() => openAccountMenu(account)}
        />
      ))}

      {hidden.length > 0 && (
        <button
          onClick={() => setShowHidden((v) => !v)}
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-sharp)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-text-disabled)",
            letterSpacing: "0.05em",
            padding: "var(--space-3) var(--space-4)",
            textAlign: "left",
          }}
        >
          {showHidden ? "▾" : "▸"} {hidden.length} hidden {hidden.length === 1 ? "account" : "accounts"}
        </button>
      )}

      {showHidden && hidden.map((account) => (
        <AccountRow
          key={account.index}
          account={account}
          accentColor={accentColor}
          identity={getAccountIdentity(account, isActive ? (sessionWallets[account.index] ?? null) : null)}
          dimmed
          isCurrent={false}
          onManage={() => openAccountMenu(account)}
        />
      ))}

      <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => navigate(`/vaults/${currentVault.id}/portfolio`)}>
          <InfoCircle size={14} weight="Linear" /> Portfolio
        </Button>
        {!watchOnly && (
          <>
            <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => setShowExport(true)}>
              <DocumentText size={14} weight="Linear" /> Export vault
            </Button>
            <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => { setShowRotate(true); setRotateDone(false); setRotateError(""); }}>
              <Key size={14} weight="Linear" /> Change password
            </Button>
          </>
        )}
      </div>

      <Sheet open={showExport} onClose={() => setShowExport(false)} title={`Export ${currentVault.name}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)" }}>
            This file contains your encrypted seed. Keep it safe. Anyone with this file and your password can access your funds.
          </span>
          <Button onClick={doExport}>Download backup file</Button>
        </div>
      </Sheet>

      {/* Add account sheet */}
      <Sheet open={addingAccount} onClose={() => setAddingAccount(false)} title={watchOnly ? "Add watch-only account" : "Add account"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {!watchOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              {(["new", "import"] as const).map((mode, i) => (
                <div key={mode} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  {i > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>/</span>}
                  <button
                    type="button"
                    onClick={() => { setAddMode(mode); setAddSeed(""); setAddSeedError(""); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", padding: 0, color: addMode === mode ? "var(--color-text-display)" : "var(--color-text-disabled)" }}
                  >
                    {mode === "new" ? "New seed" : "Import seed"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <Input label="Account name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. DeFi, Staking" autoFocus style={{ fontFamily: "var(--font-sans)" }} />
            {(() => {
              const existing = new Set(currentVault.accounts.map((a) => a.name.toLowerCase()));
              const q = addName.toLowerCase();
              const suggestions = ACCOUNT_NAME_SUGGESTIONS.filter(
                (s) => !existing.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)),
              ).slice(0, 4);
              if (!suggestions.length) return null;
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAddName(s)}
                      style={{ background: "none", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", padding: "2px var(--space-2)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          {watchOnly && (
            <Input
              label="Identity"
              value={addIdentity}
              onChange={(e) => { setAddIdentity(e.target.value); setAddError(""); }}
              error={addError}
              placeholder="Qubic identity"
              autoComplete="off"
            />
          )}
          {!watchOnly && addMode === "import" && (
            <Input
              label="Seed (55 lowercase letters)"
              type="password"
              value={addSeed}
              onChange={(e) => { setAddSeed(e.target.value); if (addSeedError) setAddSeedError(""); }}
              error={addSeedError}
              placeholder="55 characters, lowercase"
              autoComplete="off"
            />
          )}
          {!watchOnly && (
            <Input type="password" label="Vault password" value={addPassword} onChange={(e) => { setAddPassword(e.target.value); setAddError(""); }} onKeyDown={(e) => e.key === "Enter" && !addLoading && doAdd()} error={addError} placeholder="••••••••••" autoComplete="current-password" />
          )}
          <Button onClick={doAdd} loading={addLoading} disabled={!addName.trim() || (!watchOnly && !addPassword) || (!watchOnly && addMode === "import" && !addSeed.trim()) || (watchOnly && !addIdentity.trim())}>Add account</Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setAddingAccount(false)}>Cancel</Button>
        </div>
      </Sheet>

      {/* Rename sheet */}
      <Sheet open={!!renamingAccount} onClose={() => setRenamingAccount(null)} title="Rename account">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRename()} autoFocus style={{ fontFamily: "var(--font-sans)" }} />
          <Button onClick={doRename} disabled={!renameValue.trim()}>Save</Button>
        </div>
      </Sheet>

      <Sheet open={!!editingMeta} onClose={() => setEditingMeta(null)} title="Notes and tags">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="Tags"
            value={metaTags}
            onChange={(e) => setMetaTags(e.target.value)}
            placeholder="staking, cold, treasury"
          />
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              Note
            </span>
            <textarea
              value={metaNote}
              onChange={(e) => setMetaNote(e.target.value)}
              rows={4}
              placeholder="Optional note for this account"
              style={{
                width: "100%",
                resize: "vertical",
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                padding: "var(--space-3)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
              }}
            />
          </label>
          <Button onClick={saveAccountMeta}>Save</Button>
        </div>
      </Sheet>

      {/* Hide confirmation sheet */}
      <Sheet open={!!hidingAccount} onClose={() => setHidingAccount(null)} title={hidingAccount ? `Hide ${hidingAccount.name}?` : "Hide account"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
            The account will be removed from the switcher. It can be restored from this screen.
          </div>
          <Button onClick={confirmHide}>Hide account</Button>
        </div>
      </Sheet>

      {/* Remove sheet */}
      <Sheet open={!!removingAccount} onClose={() => setRemovingAccount(null)} title={removingAccount ? `Remove ${removingAccount.name}?` : "Remove account"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-error)" }}>This cannot be undone.</div>
          {!watchOnly && (
            <Input type="password" label="Vault password" value={removePassword} onChange={(e) => { setRemovePassword(e.target.value); setRemoveError(""); }} onKeyDown={(e) => e.key === "Enter" && doRemove()} error={removeError} placeholder="••••••••••" autoComplete="current-password" autoFocus />
          )}
          <Button variant="danger" shape="sharp" onClick={doRemove} loading={removeLoading} disabled={!watchOnly && !removePassword}>Remove account</Button>
        </div>
      </Sheet>

      {/* Reveal seed sheet */}
      <Sheet open={!!revealingAccount} onClose={() => setRevealingAccount(null)} title={revealingAccount ? `Reveal seed for ${revealingAccount.name}` : "Reveal seed"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {!revealedSeed ? (
            <>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                {requireBiometricForSeedReveal
                  ? "Use biometric unlock to reveal this account seed."
                  : "Enter the vault password to decrypt this account seed."}
              </div>
              {!requireBiometricForSeedReveal && (
                <Input
                  type="password"
                  label="Vault password"
                  value={revealPassword}
                  onChange={(e) => { setRevealPassword(e.target.value); setRevealError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && !revealLoading && doRevealSeed()}
                  error={revealError}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  autoFocus
                />
              )}
              {requireBiometricForSeedReveal && revealError && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
                  [{revealError}]
                </div>
              )}
              <Button onClick={doRevealSeed} loading={revealLoading} disabled={!requireBiometricForSeedReveal && !revealPassword}>
                {requireBiometricForSeedReveal ? "Use biometric" : "Reveal seed"}
              </Button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
                [SEED VISIBLE FOR {seedSecsLeft}s]
              </div>
              <div
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "var(--radius-sharp)",
                  padding: "var(--space-4)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-mono-lg)",
                  color: "var(--color-text-display)",
                  letterSpacing: "0.08em",
                  lineHeight: 1.8,
                  wordBreak: "break-all",
                }}
              >
                {revealedSeed}
              </div>
              <Button variant="secondary" shape="sharp" onClick={copyRevealedSeed}>
                {seedCopied ? "Copied" : "Copy"}
              </Button>
            </>
          )}
        </div>
      </Sheet>

      {/* Password rotation sheet */}
      <Sheet open={showRotate} onClose={() => setShowRotate(false)} title="Change vault password">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {rotateDone ? (
            <>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-success)", letterSpacing: "0.05em" }}>
                Password changed
              </div>
              <Button onClick={() => setShowRotate(false)}>Done</Button>
            </>
          ) : (
            <>
              <Input type="password" label="Current password" value={rotateOldPassword} onChange={(e) => { setRotateOldPassword(e.target.value); setRotateError(""); }} error="" placeholder="••••••••••" autoComplete="current-password" autoFocus />
              <Input type="password" label="New password" value={rotateNewPassword} onChange={(e) => { setRotateNewPassword(e.target.value); setRotateError(""); }} placeholder="••••••••••" autoComplete="new-password" />
              <Input type="password" label="Confirm new password" value={rotateConfirm} onChange={(e) => { setRotateConfirm(e.target.value); setRotateError(""); }} onKeyDown={(e) => e.key === "Enter" && !rotateLoading && doRotatePassword()} error={rotateError} placeholder="•••••••••" autoComplete="new-password" />
              <Button onClick={doRotatePassword} loading={rotateLoading} disabled={!rotateOldPassword || !rotateNewPassword || !rotateConfirm}>
                Change password
              </Button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet
        open={!!selectedAccount}
        onClose={closeAccountMenu}
        title={selectedAccount ? `Manage ${selectedAccount.name}` : "Manage account"}
        footer={
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={closeAccountMenu}>
            Close
          </Button>
        }
      >
        {selectedAccount && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-3)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
              }}
            >
              <Identicon seed={getAccountIdentity(selectedAccount, sessionWallets[selectedAccount.index] ?? null) ?? selectedAccount.name} size={40} radius={6} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                  {selectedAccount.name}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                  ACCOUNT {selectedAccount.index + 1}
                  {selectedAccount.hidden ? " · HIDDEN" : ""}
                  {isActive && settings.activeAccountIndex === selectedAccount.index ? " · ACTIVE" : ""}
                </div>
              </div>
              {vaultBalances && (() => {
                const id = getAccountIdentity(selectedAccount, sessionWallets[selectedAccount.index] ?? null);
                const bal = id ? vaultBalances[id] ?? null : null;
                return bal !== null ? (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-display)", flexShrink: 0 }}>
                    {formatQu(bal)} QU
                  </span>
                ) : null;
              })()}
            </div>

            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Identity
            </div>
            <ActionCard
              title="Rename"
              description="Change the label shown in the vault and account switcher."
              icon={Pen2}
              onClick={() => {
                setRenamingAccount(selectedAccount);
                setRenameValue(selectedAccount.name);
                closeAccountMenu();
              }}
            />
            <ActionCard
              title="Notes and tags"
              description="Add labels like staking, cold, or trading and keep a short note."
              icon={DocumentText}
              onClick={() => {
                setEditingMeta(selectedAccount);
                setMetaNote(selectedAccount.note ?? "");
                setMetaTags((selectedAccount.tags ?? []).join(", "));
                closeAccountMenu();
              }}
            />

            {!watchOnly && (
              <>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Security
                </div>
                <ActionCard
                  title="Reveal seed"
                  description="Decrypt and display this account seed for a limited time."
                  icon={Key}
                  onClick={() => {
                    openReveal(selectedAccount);
                    closeAccountMenu();
                  }}
                />
              </>
            )}

            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Visibility
            </div>
            <ActionCard
              title={selectedAccount.hidden ? "Unhide account" : "Hide account"}
              description={selectedAccount.hidden ? "Show this account in the switcher again." : "Remove this account from the switcher without deleting it."}
              icon={selectedAccount.hidden ? Eye : EyeClosed}
              onClick={() => {
                toggleHide(selectedAccount);
                closeAccountMenu();
              }}
            />

            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-status-error)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "var(--space-2)" }}>
              Danger zone
            </div>
            <ActionCard
              title="Remove account"
              description="Delete this account from the vault. This cannot be undone."
              icon={TrashBinMinimalistic}
              danger
              onClick={() => {
                setRemovingAccount(selectedAccount);
                setRemovePassword("");
                setRemoveError("");
                closeAccountMenu();
              }}
            />
          </div>
        )}
      </Sheet>
    </AppShell>
  );
}

interface AccountRowProps {
  account: AccountMeta;
  accentColor: string;
  identity: string | null;
  isCurrent: boolean;
  dimmed?: boolean;
  flashSuccess?: boolean;
  balance?: bigint | null;
  onManage: () => void;
}

function AccountRow({ account, accentColor, identity, isCurrent, dimmed, flashSuccess, balance, onManage }: AccountRowProps) {
  const tags = account.tags ?? [];
  const note = account.note?.trim() ?? "";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`stagger-item${flashSuccess ? " flash-success" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onManage}
      style={{
        opacity: dimmed ? 0.55 : 1,
        background: hovered ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: "1px solid var(--color-border-strong)",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-3)",
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "background 0.12s ease, transform 0.12s ease",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <Identicon seed={identity ?? account.name} size={40} radius={6} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: 2 }}>
              {account.name}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              ACCOUNT {account.index + 1}
            </div>
          </div>
          {balance !== null && balance !== undefined ? (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-display)", flexShrink: 0 }}>
              {formatQu(balance)}
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onManage(); }}
              style={{
                background: "none",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-mono-sm)",
                color: "var(--color-text-secondary)",
                letterSpacing: "0.05em",
                padding: "var(--space-1) var(--space-2)",
                flexShrink: 0,
              }}
            >
              Manage
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {isCurrent && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: accentColor, letterSpacing: "0.05em" }}>
              Active
            </span>
          )}
          {account.hidden && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              Hidden
            </span>
          )}
          {tags.map((tag) => (
            <span key={tag} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
              #{tag}
            </span>
          ))}
        </div>
        {note && (
          <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {note}
          </div>
        )}
        {identity && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <IdentityDisplay identity={identity} showIdenticon={false} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  icon: Icon,
  danger,
  onClick,
}: {
  title: string;
  description: string;
  icon?: typeof Pen2;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        textAlign: "left",
        background: danger ? "color-mix(in srgb, var(--color-status-error) 8%, var(--color-bg-surface))" : "var(--color-bg-surface)",
        border: `1px solid ${danger ? "color-mix(in srgb, var(--color-status-error) 40%, var(--color-border-strong))" : "var(--color-border-strong)"}`,
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      {Icon && (
        <Icon size={18} weight="Linear" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: danger ? "var(--color-status-error)" : "var(--color-text-display)" }}>
          {title}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: danger ? "var(--color-status-error)" : "var(--color-text-disabled)", letterSpacing: "0.05em", flexShrink: 0 }}>
        →
      </span>
    </button>
  );
}
