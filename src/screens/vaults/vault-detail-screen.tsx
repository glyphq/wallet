import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type AccountMeta } from "@/store/persisted";
import { MAX_VAULT_ACCOUNTS, useVaultBalances } from "@/hooks/use-vault-balances";
import { useSessionStore } from "@/store/session";
import { deriveIdentityFromSeed, generateRandomSeed, toSeed, InvalidSeedError, type Seed } from "@/lib/crypto";
import { addToVault, removeFromVault, exportVault, revealVaultSeed, rotateVaultPassword, unlockVaultSession } from "@/lib/vault";
import { Identicon } from "@/components/identicon";
import { saveFileDialog } from "@/lib/save-file";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { getAccountIdentity, parseAccountTags } from "@/lib/accounts";
import { createSignedExportEnvelope } from "@/lib/export-format";
import { recordAuditEvent } from "@/lib/audit-log";
import { formatQu } from "@/lib/format";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-strength";
import { requiresBiometricSeedReveal } from "@/lib/session-policies";
import {
  PencilEdit01Icon, File02Icon, Key01Icon, ViewOffIcon, ViewIcon, Delete02Icon,
  AddCircleIcon, InformationCircleIcon, CheckmarkCircle01Icon,
} from "@/lib/icons";
import { AccountRow, ActionRow, ActionSection } from "./vault-detail-parts";
import {
  AccountMetaSheet,
  AddAccountSheet,
  HideAccountSheet,
  RemoveAccountSheet,
  RenameAccountSheet,
} from "./vault-account-sheets";
import { ExportVaultSheet, RotatePasswordSheet } from "./vault-admin-sheets";
import { SeedRevealSheet } from "./vault-seed-sheet";

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
  const biometricRevealRequired = requiresBiometricSeedReveal(
    requireBiometricForSeedReveal,
    biometricVaultIds,
    currentVault.id,
  );

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
        const wallets = await unlockVaultSession(newEncrypted, addPassword);
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
        const wallets = await unlockVaultSession(newEncrypted, removePassword);
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
    if (rotateNewPassword.length < MIN_PASSWORD_LENGTH) { setRotateError(`Password too short (min ${MIN_PASSWORD_LENGTH} chars)`); return; }
    setRotateLoading(true);
    setRotateError("");
    try {
      const newEncrypted = await rotateVaultPassword(currentVault.encryptedData!, rotateOldPassword, rotateNewPassword);
      updateVault(currentVault.id, { encryptedData: newEncrypted });
      if (isActive) {
        const wallets = await unlockVaultSession(newEncrypted, rotateNewPassword);
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
      if (biometricRevealRequired) {
        const { invoke } = await import("@tauri-apps/api/core");
        const seed = await invoke<string>("reveal_seed_with_biometric", {
          vaultId: currentVault.id,
          vaultData: currentVault.encryptedData!,
          accountIndex: revealingAccount.index,
        });
        seeds = [];
        seeds[revealingAccount.index] = toSeed(seed);
      } else {
        const seed = await revealVaultSeed(currentVault.encryptedData!, revealPassword, revealingAccount.index);
        seeds = [];
        seeds[revealingAccount.index] = toSeed(seed);
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
            <AddCircleIcon size={16} strokeWidth={1.5} aria-hidden="true" />
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
          <InformationCircleIcon size={14} strokeWidth={1.5} /> Portfolio
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => setShowExport(true)}>
          <File02Icon size={14} strokeWidth={1.5} /> Export vault
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => { setShowRotate(true); setRotateDone(false); setRotateError(""); }}>
          <Key01Icon size={14} strokeWidth={1.5} /> Change password
        </Button>
      </div>

      <ExportVaultSheet
        open={showExport}
        onClose={() => setShowExport(false)}
        vaultName={currentVault.name}
        onExport={doExport}
      />

      {/* Add account sheet */}
      <AddAccountSheet
        open={addingAccount}
        onClose={() => setAddingAccount(false)}
        accounts={currentVault.accounts}
        mode={addMode}
        setMode={setAddMode}
        name={addName}
        setName={setAddName}
        seed={addSeed}
        setSeed={setAddSeed}
        seedError={addSeedError}
        setSeedError={setAddSeedError}
        password={addPassword}
        setPassword={setAddPassword}
        error={addError}
        setError={setAddError}
        loading={addLoading}
        onAdd={doAdd}
      />

      {/* Rename sheet */}
      <RenameAccountSheet
        open={!!renamingAccount}
        onClose={() => setRenamingAccount(null)}
        value={renameValue}
        onChange={setRenameValue}
        onSave={doRename}
      />

      <AccountMetaSheet
        open={!!editingMeta}
        onClose={() => setEditingMeta(null)}
        tags={metaTags}
        setTags={setMetaTags}
        note={metaNote}
        setNote={setMetaNote}
        onSave={saveAccountMeta}
      />

      {/* Hide confirmation sheet */}
      <HideAccountSheet account={hidingAccount} onClose={() => setHidingAccount(null)} onConfirm={confirmHide} />

      {/* Remove sheet */}
      <RemoveAccountSheet
        account={removingAccount}
        onClose={() => setRemovingAccount(null)}
        password={removePassword}
        setPassword={setRemovePassword}
        error={removeError}
        setError={setRemoveError}
        loading={removeLoading}
        onRemove={doRemove}
      />

      {/* Reveal seed sheet */}
      <SeedRevealSheet
        account={revealingAccount}
        onClose={() => setRevealingAccount(null)}
        verifyingBackup={verifyingBackup}
        biometricRevealRequired={biometricRevealRequired}
        revealedSeed={revealedSeed}
        seedVisible={seedVisible}
        onToggleSeedVisible={() => setSeedVisible((value) => !value)}
        seedCopied={seedCopied}
        seedSecsLeft={seedSecsLeft}
        onCopy={copyRevealedSeed}
        password={revealPassword}
        onPasswordChange={(value) => { setRevealPassword(value); setRevealError(""); }}
        error={revealError}
        loading={revealLoading}
        onReveal={doRevealSeed}
        backupCheck={backupCheck}
        onBackupCheckChange={(value) => { setBackupCheck(value); setBackupCheckStatus("idle"); }}
        backupCheckStatus={backupCheckStatus}
        onVerify={verifyBackupSeed}
      />

      {/* Password rotation sheet */}
      <RotatePasswordSheet
        open={showRotate}
        onClose={() => setShowRotate(false)}
        done={rotateDone}
        oldPassword={rotateOldPassword}
        setOldPassword={setRotateOldPassword}
        newPassword={rotateNewPassword}
        setNewPassword={setRotateNewPassword}
        confirmPassword={rotateConfirm}
        setConfirmPassword={setRotateConfirm}
        error={rotateError}
        setError={setRotateError}
        loading={rotateLoading}
        onSubmit={doRotatePassword}
      />

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
                icon={CheckmarkCircle01Icon}
                selected={isActive && settings.activeAccountIndex === selectedAccount.index}
                disabled={!isActive || selectedAccount.hidden || settings.activeAccountIndex === selectedAccount.index}
                onClick={() => makeActive(selectedAccount)}
              />
            </ActionSection>

            <ActionSection title="Details">
              <ActionRow
                title="Rename"
                description="Change the label shown in the vault and switcher."
                icon={PencilEdit01Icon}
                onClick={() => {
                  setRenamingAccount(selectedAccount);
                  setRenameValue(selectedAccount.name);
                  closeAccountMenu();
                }}
              />
              <ActionRow
                title="Notes and tags"
                description="Keep metadata such as staking, cold, or treasury."
                icon={File02Icon}
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
                icon={CheckmarkCircle01Icon}
                onClick={() => {
                  openBackupVerification();
                  closeAccountMenu();
                }}
              />
              <ActionRow
                title="Reveal seed"
                description="Decrypt and display this account seed for a limited time."
                icon={Key01Icon}
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
                icon={selectedAccount.hidden ? ViewIcon : ViewOffIcon}
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
                icon={Delete02Icon}
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
