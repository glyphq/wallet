import { useEffect, useState, useRef, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SeedSurface } from "@/components/setup-flow";
import { Textarea } from "@/components/textarea";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type AccountMeta } from "@/store/persisted";
import { MAX_VAULT_ACCOUNTS, useVaultBalances } from "@/hooks/use-vault-balances";
import { useSessionStore } from "@/store/session";
import { deriveIdentityFromSeed, generateRandomSeed, toSeed, InvalidSeedError, type Seed } from "@/lib/crypto";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, addToVault, removeFromVault, exportVault, createVault } from "@/lib/vault";
import { IdentityDisplay } from "@/components/identity-display";
import { Identicon } from "@/components/identicon";
import { saveFileDialog } from "@/lib/save-file";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { getAccountIdentity, parseAccountTags } from "@/lib/accounts";
import { createSignedExportEnvelope } from "@/lib/export-format";
import { recordAuditEvent } from "@/lib/audit-log";
import { formatQu } from "@/lib/format";
import {
  Pen2, DocumentText, Key, EyeClosed, Eye, TrashBinMinimalistic,
  AddCircle, InfoCircle, CheckCircle,
} from "@solar-icons/react";

const ACCOUNT_NAME_SUGGESTIONS = [
  "Main", "Trading", "Staking", "Cold Storage", "DeFi", "Savings",
  "Hot Wallet", "Treasury", "Operations", "Rewards",
];

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
  const [seedVisible, setSeedVisible] = useState(true);
  const [seedCopied, setSeedCopied] = useState(false);
  const [seedSecsLeft, setSeedSecsLeft] = useState(0);
  const [verifyingBackup, setVerifyingBackup] = useState(false);
  const [backupCheck, setBackupCheck] = useState("");
  const [backupCheckStatus, setBackupCheckStatus] = useState<"idle" | "match" | "mismatch">("idle");
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


  function openAccountMenu(account: AccountMeta) {
    setSelectedAccount(account);
  }

  function closeAccountMenu() {
    setSelectedAccount(null);
  }

  function openAdd() {
    setAddMode("new");
    setAddName("");
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
        const wallets = await unlockSecureSession(allSeeds);
        sessionUnlock(currentVault.id, wallets);
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

  function makeActive(account: AccountMeta) {
    if (!isActive || account.hidden) return;
    setActiveAccountIndex(account.index);
    closeAccountMenu();
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
      const newEncrypted = await removeFromVault(currentVault.encryptedData!, removePassword, removingAccount.index);
      const updatedAccounts = currentVault.accounts
        .filter((a) => a.index !== removingAccount.index)
        .map((a) => ({ ...a, index: a.index > removingAccount.index ? a.index - 1 : a.index }));
      updateVault(currentVault.id, { encryptedData: newEncrypted, accounts: updatedAccounts });
      if (isActive) {
        const remaining = await unlockVault(newEncrypted, removePassword);
        const wallets = await unlockSecureSession(remaining);
        sessionUnlock(currentVault.id, wallets);
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
        const wallets = await unlockSecureSession(seeds);
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
    setSeedVisible(true);
    setSeedCopied(false);
    setVerifyingBackup(false);
    setBackupCheck("");
    setBackupCheckStatus("idle");
  }

  function openBackupVerification() {
    const firstAccount = currentVault.accounts.find((account) => account.index === 0) ?? currentVault.accounts[0];
    if (!firstAccount) return;
    openReveal(firstAccount);
    setSeedVisible(false);
    setVerifyingBackup(true);
  }

  async function doRevealSeed() {
    if (!revealingAccount) return;
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
        const seed = await invoke<string>("reveal_seed_with_biometric", {
          vaultId: currentVault.id,
          vaultData: currentVault.encryptedData!,
          accountIndex: revealingAccount.index,
        });
        seeds = [];
        seeds[revealingAccount.index] = toSeed(seed);
      } else {
        seeds = await unlockVault(currentVault.encryptedData!, revealPassword);
      }
      const seed = seeds[revealingAccount.index];
      if (!seed) throw new Error("Missing seed");
      setRevealedSeed(seed);
      if (!verifyingBackup) setSeedVisible(true);
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

  function verifyBackupSeed() {
    if (!revealedSeed) return;
    setBackupCheckStatus(backupCheck.trim().toLowerCase() === revealedSeed ? "match" : "mismatch");
  }

  return (
    <AppShell contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {currentVault.accounts.length < MAX_VAULT_ACCOUNTS ? (
          <Button variant="secondary" shape="sharp" size="sm" onClick={openAdd} style={{ width: "auto" }}>
            <AddCircle size={16} weight="Linear" aria-hidden="true" />
            Add account
          </Button>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.05em", alignSelf: "center" }}>
            16 MAX
          </span>
        )}
      </div>
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
          identity={getAccountIdentity(account, isActive ? (sessionWallets[account.index] ?? null) : null)}
          isCurrent={isActive && settings.activeAccountIndex === account.index}
          flashSuccess={newlyAddedIndex === account.index}
          balance={isActive && vaultBalances ? vaultBalances[getAccountIdentity(account, sessionWallets[account.index] ?? null) ?? ""] ?? null : null}
          hideBalances={settings.hideBalances}
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
          identity={getAccountIdentity(account, isActive ? (sessionWallets[account.index] ?? null) : null)}
          dimmed
          isCurrent={false}
          hideBalances={settings.hideBalances}
          onManage={() => openAccountMenu(account)}
        />
      ))}

      <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => navigate(`/vaults/${currentVault.id}/portfolio`)}>
          <InfoCircle size={14} weight="Linear" /> Portfolio
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => setShowExport(true)}>
          <DocumentText size={14} weight="Linear" /> Export vault
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => { setShowRotate(true); setRotateDone(false); setRotateError(""); }}>
          <Key size={14} weight="Linear" /> Change password
        </Button>
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
      <Sheet open={addingAccount} onClose={() => setAddingAccount(false)} title="Add account">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
          {addMode === "import" && (
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
          <Input type="password" label="Vault password" value={addPassword} onChange={(e) => { setAddPassword(e.target.value); setAddError(""); }} onKeyDown={(e) => e.key === "Enter" && !addLoading && doAdd()} error={addError} placeholder="••••••••••" autoComplete="current-password" />
          <Button onClick={doAdd} loading={addLoading} disabled={!addName.trim() || !addPassword || (addMode === "import" && !addSeed.trim())}>Add account</Button>
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
          <Input type="password" label="Vault password" value={removePassword} onChange={(e) => { setRemovePassword(e.target.value); setRemoveError(""); }} onKeyDown={(e) => e.key === "Enter" && doRemove()} error={removeError} placeholder="••••••••••" autoComplete="current-password" autoFocus />
          <Button variant="danger" shape="sharp" onClick={doRemove} loading={removeLoading} disabled={!removePassword}>Remove account</Button>
        </div>
      </Sheet>

      {/* Reveal seed sheet */}
      <Sheet open={!!revealingAccount} onClose={() => setRevealingAccount(null)} title={verifyingBackup ? "Verify seed backup" : revealingAccount ? `Reveal seed for ${revealingAccount.name}` : "Reveal seed"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {!revealedSeed ? (
            <>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                {verifyingBackup
                  ? "Unlock once, then type your saved seed to confirm the backup."
                  : requireBiometricForSeedReveal
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
                {requireBiometricForSeedReveal ? "Use biometric" : verifyingBackup ? "Unlock seed" : "Reveal seed"}
              </Button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
                {seedVisible ? "Shown" : "Hidden"}. Closes in {seedSecsLeft}s.
              </div>
              <SeedSurface seed={revealedSeed} revealed={seedVisible} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <Button variant="secondary" shape="sharp" onClick={copyRevealedSeed}>
                  {seedCopied ? "Copied" : "Copy seed"}
                </Button>
                <Button variant="secondary" shape="sharp" onClick={() => setSeedVisible((value) => !value)} aria-pressed={seedVisible}>
                  {seedVisible ? <EyeClosed size={18} weight="Linear" aria-hidden="true" /> : <Eye size={18} weight="Linear" aria-hidden="true" />}
                  {seedVisible ? "Hide" : "Reveal"}
                </Button>
              </div>
              {verifyingBackup ? (
                <>
                  <Textarea
                    value={backupCheck}
                    onChange={(event) => { setBackupCheck(event.target.value); setBackupCheckStatus("idle"); }}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") verifyBackupSeed();
                    }}
                    placeholder="Type your saved seed"
                    aria-label="Saved seed"
                    technical
                    style={{ resize: "none", minHeight: 112, borderRadius: "var(--radius-control)", background: "var(--color-bg-input)", overflowWrap: "anywhere" }}
                  />
                  {backupCheckStatus !== "idle" ? (
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: backupCheckStatus === "match" ? "var(--color-status-success)" : "var(--color-status-error)" }}>
                      {backupCheckStatus === "match" ? "Backup verified" : "Seed does not match"}
                    </div>
                  ) : null}
                  <Button onClick={verifyBackupSeed} disabled={!backupCheck.trim()}>Verify backup</Button>
                </>
              ) : null}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                paddingBottom: "var(--space-4)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <Identicon kind="account" code={`A${selectedAccount.index + 1}`} seed={getAccountIdentity(selectedAccount, sessionWallets[selectedAccount.index] ?? null) ?? selectedAccount.name} label={selectedAccount.name} size={40} radius={8} style={{ flexShrink: 0 }} />
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
                    {settings.hideBalances ? "••••••" : `${formatQu(bal)} QU`}
                  </span>
                ) : null;
              })()}
            </div>

            <ActionSection title="Selection">
              <ActionRow
                title={isActive && settings.activeAccountIndex === selectedAccount.index ? "Active account" : "Use this account"}
                description={selectedAccount.hidden ? "Hidden accounts cannot be made active." : "Use for sending, receiving, and signing."}
                icon={CheckCircle}
                selected={isActive && settings.activeAccountIndex === selectedAccount.index}
                disabled={!isActive || selectedAccount.hidden || settings.activeAccountIndex === selectedAccount.index}
                onClick={() => makeActive(selectedAccount)}
              />
            </ActionSection>

            <ActionSection title="Details">
              <ActionRow
                title="Rename"
                description="Change the label shown in the vault and switcher."
                icon={Pen2}
                onClick={() => {
                  setRenamingAccount(selectedAccount);
                  setRenameValue(selectedAccount.name);
                  closeAccountMenu();
                }}
              />
              <ActionRow
                title="Notes and tags"
                description="Keep metadata such as staking, cold, or treasury."
                icon={DocumentText}
                onClick={() => {
                  setEditingMeta(selectedAccount);
                  setMetaNote(selectedAccount.note ?? "");
                  setMetaTags((selectedAccount.tags ?? []).join(", "));
                  closeAccountMenu();
                }}
              />
            </ActionSection>

            <ActionSection title="Security">
              <ActionRow
                title="Verify backup"
                description="Check your saved seed against this vault. Hidden by default."
                icon={CheckCircle}
                onClick={() => {
                  openBackupVerification();
                  closeAccountMenu();
                }}
              />
              <ActionRow
                title="Reveal seed"
                description="Decrypt and display this account seed for a limited time."
                icon={Key}
                onClick={() => {
                  openReveal(selectedAccount);
                  closeAccountMenu();
                }}
              />
            </ActionSection>

            <ActionSection title="Visibility">
              <ActionRow
                title={selectedAccount.hidden ? "Unhide account" : "Hide account"}
                description={selectedAccount.hidden ? "Show this account in the switcher again." : "Remove from the switcher without deleting it."}
                icon={selectedAccount.hidden ? Eye : EyeClosed}
                onClick={() => {
                  toggleHide(selectedAccount);
                  closeAccountMenu();
                }}
              />
            </ActionSection>

            <ActionSection title="Danger zone" danger>
              <ActionRow
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
            </ActionSection>
          </div>
        )}
      </Sheet>
    </AppShell>
  );
}

interface AccountRowProps {
  account: AccountMeta;
  identity: string | null;
  isCurrent: boolean;
  dimmed?: boolean;
  flashSuccess?: boolean;
  balance?: bigint | null;
  hideBalances: boolean;
  onManage: () => void;
}

function AccountRow({ account, identity, isCurrent, dimmed, flashSuccess, balance, hideBalances, onManage }: AccountRowProps) {
  const tags = account.tags ?? [];
  const note = account.note?.trim() ?? "";
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={`stagger-item${flashSuccess ? " flash-success" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onManage}
      style={{
        opacity: dimmed ? 0.55 : 1,
        background: hovered ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-3)",
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "background 0.12s ease, border-color 0.12s ease",
      }}
    >
      <Identicon kind="account" code={`A${account.index + 1}`} seed={identity ?? account.name} label={account.name} size={40} radius={8} style={{ marginTop: 2, flexShrink: 0 }} />
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
              {hideBalances ? "••••••" : formatQu(balance)}
            </span>
          ) : (
            <span
              style={{
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-mono-sm)",
                color: "var(--color-text-secondary)",
                letterSpacing: "0.05em",
                padding: "var(--space-1) var(--space-2)",
                flexShrink: 0,
              }}
            >
              Manage
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {isCurrent && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-accent)", letterSpacing: "0.05em" }}>
              <CheckCircle size={14} weight="Outline" aria-hidden="true" /> Active
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
    </button>
  );
}

function ActionSection({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: danger ? "var(--color-status-error)" : "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
        {title}
      </div>
      <div style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        {children}
      </div>
    </section>
  );
}

function ActionRow({
  title,
  description,
  icon: Icon,
  selected,
  disabled,
  danger,
  onClick,
}: {
  title: string;
  description: string;
  icon?: typeof Pen2;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const muted = disabled && !selected;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--color-border-subtle)",
        borderRadius: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: muted ? 0.55 : 1,
        padding: "var(--space-3) 0",
        transform: "none",
      }}
    >
      {Icon && (
        <Icon size={18} weight="Outline" color={danger ? "var(--color-status-error)" : "var(--color-text-secondary)"} aria-hidden="true" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: danger ? "var(--color-status-error)" : "var(--color-text-display)" }}>
          {title}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      {selected ? (
        <CheckCircle size={18} weight="Outline" color="var(--color-accent)" aria-label="Selected" />
      ) : (
        <span style={{ width: 18, height: 18, border: "1px solid var(--color-border-strong)", borderRadius: "999px", flexShrink: 0 }} aria-hidden="true" />
      )}
    </button>
  );
}
