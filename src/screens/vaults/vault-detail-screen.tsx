import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type AccountMeta } from "@/store/persisted";
import { MAX_VAULT_ACCOUNTS } from "@/hooks/use-vault-balances";
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
      sigil: 1,
      name: currentVault.name,
      color: currentVault.color,
      accounts: currentVault.accounts,
      exported_at: Date.now(),
      vault: JSON.parse(exportVault(currentVault.encryptedData)),
    });
    const data = JSON.stringify(envelope, null, 2);
    const defaultName = `sigil-${currentVault.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vault"}.json`;
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
        setAddError("INVALID IDENTITY");
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
      setAddingAccount(false);
      return;
    }

    let seedToAdd: Seed | null = null;
    if (addMode === "import") {
      try {
        seedToAdd = toSeed(addSeed.trim().toLowerCase());
      } catch (e) {
        setAddSeedError(e instanceof InvalidSeedError ? "55 LOWERCASE LETTERS REQUIRED" : "INVALID SEED");
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
      setAddingAccount(false);
    } catch {
      setAddError("WRONG PASSWORD");
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
      setRemoveError("WRONG PASSWORD");
    } finally {
      setRemoveLoading(false);
    }
  }

  async function doRotatePassword() {
    if (!rotateOldPassword || !rotateNewPassword) return;
    if (rotateNewPassword !== rotateConfirm) { setRotateError("PASSWORDS DO NOT MATCH"); return; }
    if (rotateNewPassword.length < 8) { setRotateError("PASSWORD TOO SHORT (MIN 8 CHARS)"); return; }
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
      setRotateError("WRONG PASSWORD");
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
          setRevealError("ENABLE BIOMETRIC FOR THIS VAULT FIRST");
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
      setRevealError("WRONG PASSWORD");
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
          ? <button type="button" onClick={openAdd} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0 }}>+ ADD</button>
          : <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>16 MAX</span>
      }
    />
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {visible.map((account) => (
        <AccountRow
          key={account.index}
          account={account}
          accentColor={accentColor}
          identity={getAccountIdentity(account, isActive ? (sessionWallets[account.index] ?? null) : null)}
          isCurrent={isActive && settings.activeAccountIndex === account.index}
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
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-text-disabled)",
            letterSpacing: "0.05em",
            padding: "var(--space-3) var(--space-4)",
            textAlign: "left",
          }}
        >
          {showHidden ? "▾" : "▸"} {hidden.length} HIDDEN {hidden.length === 1 ? "ACCOUNT" : "ACCOUNTS"}
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

      {!watchOnly && (
        <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => setShowExport(true)}>
            Export vault
          </Button>
          <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => { setShowRotate(true); setRotateDone(false); setRotateError(""); }}>
            Change password
          </Button>
        </div>
      )}

      {/* Export modal */}
      <Modal open={showExport} onClose={() => setShowExport(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            Export {currentVault.name}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
            [WARNING] This file contains your encrypted seed. Keep it safe. Anyone with this file and your password can access your funds.
          </div>
          <Button onClick={doExport}>Download backup file</Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setShowExport(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* Add account modal */}
      <Modal open={addingAccount} onClose={() => setAddingAccount(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            {watchOnly ? "Add watch-only account" : "Add account"}
          </div>
          {!watchOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              {(["new", "import"] as const).map((mode, i) => (
                <div key={mode} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  {i > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>/</span>}
                  <button
                    type="button"
                    onClick={() => { setAddMode(mode); setAddSeed(""); setAddSeedError(""); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", padding: 0, color: addMode === mode ? "var(--color-text-display)" : "var(--color-text-disabled)" }}
                  >
                    {mode === "new" ? "NEW SEED" : "IMPORT SEED"}
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
                      style={{ background: "none", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", padding: "2px var(--space-2)" }}
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
      </Modal>

      {/* Rename modal */}
      <Modal open={!!renamingAccount} onClose={() => setRenamingAccount(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>Rename account</div>
          <Input label="Name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRename()} autoFocus style={{ fontFamily: "var(--font-sans)" }} />
          <Button onClick={doRename} disabled={!renameValue.trim()}>Save</Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setRenamingAccount(null)}>Cancel</Button>
        </div>
      </Modal>

      <Modal open={!!editingMeta} onClose={() => setEditingMeta(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>Notes and tags</div>
          <Input
            label="Tags"
            value={metaTags}
            onChange={(e) => setMetaTags(e.target.value)}
            placeholder="staking, cold, treasury"
          />
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setEditingMeta(null)}>Cancel</Button>
        </div>
      </Modal>

      {/* Hide confirmation modal */}
      <Modal open={!!hidingAccount} onClose={() => setHidingAccount(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            Hide {hidingAccount?.name}?
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
            The account will be removed from the switcher. It can be restored from this screen.
          </div>
          <Button onClick={confirmHide}>Hide account</Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setHidingAccount(null)}>Cancel</Button>
        </div>
      </Modal>

      {/* Remove modal */}
      <Modal open={!!removingAccount} onClose={() => setRemovingAccount(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-1)" }}>Remove {removingAccount?.name}?</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-error)" }}>This cannot be undone.</div>
          </div>
          {!watchOnly && (
            <Input type="password" label="Vault password" value={removePassword} onChange={(e) => { setRemovePassword(e.target.value); setRemoveError(""); }} onKeyDown={(e) => e.key === "Enter" && doRemove()} error={removeError} placeholder="••••••••••" autoComplete="current-password" autoFocus />
          )}
          <Button variant="danger" shape="sharp" onClick={doRemove} loading={removeLoading} disabled={!watchOnly && !removePassword}>Remove account</Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setRemovingAccount(null)}>Cancel</Button>
        </div>
      </Modal>

      {/* Reveal seed modal */}
      <Modal open={!!revealingAccount} onClose={() => setRevealingAccount(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            Reveal seed for {revealingAccount?.name}
          </div>
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
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
                  [{revealError}]
                </div>
              )}
              <Button onClick={doRevealSeed} loading={revealLoading} disabled={!requireBiometricForSeedReveal && !revealPassword}>
                {requireBiometricForSeedReveal ? "Use biometric" : "Reveal seed"}
              </Button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
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
                {seedCopied ? "[COPIED]" : "Copy"}
              </Button>
            </>
          )}
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setRevealingAccount(null)}>
            Close
          </Button>
        </div>
      </Modal>

      {/* Password rotation modal */}
      <Modal open={showRotate} onClose={() => setShowRotate(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            Change vault password
          </div>
          {rotateDone ? (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-success)", letterSpacing: "0.05em" }}>
                [PASSWORD CHANGED SUCCESSFULLY]
              </div>
              <Button onClick={() => setShowRotate(false)}>Done</Button>
            </>
          ) : (
            <>
              <Input type="password" label="Current password" value={rotateOldPassword} onChange={(e) => { setRotateOldPassword(e.target.value); setRotateError(""); }} error="" placeholder="••••••••••" autoComplete="current-password" autoFocus />
              <Input type="password" label="New password" value={rotateNewPassword} onChange={(e) => { setRotateNewPassword(e.target.value); setRotateError(""); }} placeholder="••••••••••" autoComplete="new-password" />
              <Input type="password" label="Confirm new password" value={rotateConfirm} onChange={(e) => { setRotateConfirm(e.target.value); setRotateError(""); }} onKeyDown={(e) => e.key === "Enter" && !rotateLoading && doRotatePassword()} error={rotateError} placeholder="••••••••••" autoComplete="new-password" />
              <Button onClick={doRotatePassword} loading={rotateLoading} disabled={!rotateOldPassword || !rotateNewPassword || !rotateConfirm}>
                Change password
              </Button>
              <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setShowRotate(false)}>Cancel</Button>
            </>
          )}
        </div>
      </Modal>

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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                  {selectedAccount.name}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                  ACCOUNT {selectedAccount.index + 1}
                  {selectedAccount.hidden ? " · HIDDEN" : ""}
                  {isActive && settings.activeAccountIndex === selectedAccount.index ? " · ACTIVE" : ""}
                </div>
              </div>
            </div>

            <ActionCard
              title="Rename"
              description="Change the label shown in the vault and account switcher."
              onClick={() => {
                setRenamingAccount(selectedAccount);
                setRenameValue(selectedAccount.name);
                closeAccountMenu();
              }}
            />
            <ActionCard
              title="Notes and tags"
              description="Add labels like staking, cold, or trading and keep a short note."
              onClick={() => {
                setEditingMeta(selectedAccount);
                setMetaNote(selectedAccount.note ?? "");
                setMetaTags((selectedAccount.tags ?? []).join(", "));
                closeAccountMenu();
              }}
            />
            {!watchOnly && (
              <ActionCard
                title="Reveal seed"
                description="Decrypt and display this account seed for a limited time."
                onClick={() => {
                  openReveal(selectedAccount);
                  closeAccountMenu();
                }}
              />
            )}
            <ActionCard
              title={selectedAccount.hidden ? "Unhide account" : "Hide account"}
              description={selectedAccount.hidden ? "Show this account in the switcher again." : "Remove this account from the switcher without deleting it."}
              onClick={() => {
                toggleHide(selectedAccount);
                closeAccountMenu();
              }}
            />
            <ActionCard
              title="Remove account"
              description="Delete this account from the vault. This cannot be undone."
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
  onManage: () => void;
}

function AccountRow({ account, accentColor, identity, isCurrent, dimmed, onManage }: AccountRowProps) {
  const tags = account.tags ?? [];
  const note = account.note?.trim() ?? "";

  return (
    <div
      style={{
        opacity: dimmed ? 0.55 : 1,
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-strong)",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-3)",
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
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
          <button
            type="button"
            onClick={onManage}
            style={{
              background: "none",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-sharp)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-secondary)",
              letterSpacing: "0.05em",
              padding: "var(--space-1) var(--space-2)",
              flexShrink: 0,
            }}
          >
            MANAGE
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {isCurrent && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: accentColor, letterSpacing: "0.05em" }}>
              [ACTIVE]
            </span>
          )}
          {account.hidden && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              [HIDDEN]
            </span>
          )}
          {tags.map((tag) => (
            <span key={tag} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
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
  danger,
  onClick,
}: {
  title: string;
  description: string;
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
        justifyContent: "space-between",
        gap: "var(--space-4)",
        width: "100%",
        textAlign: "left",
        background: danger ? "color-mix(in srgb, var(--color-status-error) 8%, var(--color-bg-surface))" : "var(--color-bg-surface)",
        border: `1px solid ${danger ? "color-mix(in srgb, var(--color-status-error) 40%, var(--color-border-strong))" : "var(--color-border-strong)"}`,
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer",
        padding: "var(--space-4)",
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: danger ? "var(--color-status-error)" : "var(--color-text-display)", marginBottom: "var(--space-1)" }}>
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
