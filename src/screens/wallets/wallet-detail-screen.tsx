import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { usePersistedStore, type AccountMeta } from "@/store/persisted";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { useSessionStore } from "@/store/session";
import { File02Icon, InformationCircleIcon, Key01Icon } from "@/lib/icons";
import {
  AccountMetaSheet,
  AddAccountSheet,
  HideAccountSheet,
  RemoveAccountSheet,
  RenameAccountSheet,
} from "./wallet-account-sheets";
import { ExportWalletSheet, RotatePasswordSheet } from "./wallet-admin-sheets";
import { WalletAccountList } from "./wallet-account-list";
import { ManageAccountSheet } from "./wallet-manage-sheet";
import { SeedRevealSheet } from "./wallet-seed-sheet";
import { useSeedReveal } from "./use-seed-reveal";
import { useWalletAccountActions } from "./use-wallet-account-actions";
import { useWalletAddAccount } from "./use-wallet-add-account";
import { useWalletAdmin } from "./use-wallet-admin";

export default function WalletDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const sessionWallets = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((v) => v.id === id);
  const isActive = wallet?.id === settings.activeWalletId;

  const [selectedAccount, setSelectedAccount] = useState<AccountMeta | null>(null);
  const { data: walletBalances } = useWalletBalances();

  const addAccount = useWalletAddAccount(wallet, isActive);
  const actions = useWalletAccountActions(wallet, isActive);
  const reveal = useSeedReveal(wallet);
  const admin = useWalletAdmin(wallet, isActive);

  if (!wallet) return null;

  function openAccountMenu(account: AccountMeta) {
    setSelectedAccount(account);
  }

  function closeAccountMenu() {
    setSelectedAccount(null);
  }

  function makeActive(account: AccountMeta) {
    if (!isActive || account.hidden) return;
    setActiveAccountIndex(account.index);
    closeAccountMenu();
  }

  return (
    <AppShell contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <WalletAccountList
        accounts={wallet.accounts}
        isActive={isActive}
        activeAccountIndex={settings.activeAccountIndex}
        sessionWallets={sessionWallets}
        balances={walletBalances}
        hideBalances={settings.hideBalances}
        onAdd={addAccount.openAdd}
        onManage={openAccountMenu}
      />

      <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => navigate(`/wallets/${wallet.id}/portfolio`)}>
          <InformationCircleIcon size={14} strokeWidth={1.5} /> Portfolio
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={() => admin.setShowExport(true)}>
          <File02Icon size={14} strokeWidth={1.5} /> Export wallet
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }} onClick={admin.openRotate}>
          <Key01Icon size={14} strokeWidth={1.5} /> Change password
        </Button>
      </div>

      <ExportWalletSheet
        open={admin.showExport}
        onClose={() => admin.setShowExport(false)}
        walletName={wallet.name}
        onExport={admin.doExport}
      />

      {/* Add account sheet */}
      <AddAccountSheet
        open={addAccount.addingAccount}
        onClose={() => addAccount.setAddingAccount(false)}
        accounts={wallet.accounts}
        mode={addAccount.addMode}
        setMode={addAccount.setAddMode}
        name={addAccount.addName}
        setName={addAccount.setAddName}
        seed={addAccount.addSeed}
        setSeed={addAccount.setAddSeed}
        seedError={addAccount.addSeedError}
        setSeedError={addAccount.setAddSeedError}
        password={addAccount.addPassword}
        setPassword={addAccount.setAddPassword}
        error={addAccount.addError}
        setError={addAccount.setAddError}
        loading={addAccount.addLoading}
        onAdd={addAccount.doAdd}
      />

      {/* Rename sheet */}
      <RenameAccountSheet
        open={!!actions.renamingAccount}
        onClose={() => actions.setRenamingAccount(null)}
        value={actions.renameValue}
        onChange={actions.setRenameValue}
        onSave={actions.doRename}
      />

      <AccountMetaSheet
        open={!!actions.editingMeta}
        onClose={() => actions.setEditingMeta(null)}
        tags={actions.metaTags}
        setTags={actions.setMetaTags}
        note={actions.metaNote}
        setNote={actions.setMetaNote}
        onSave={actions.saveAccountMeta}
      />

      {/* Hide confirmation sheet */}
      <HideAccountSheet account={actions.hidingAccount} onClose={() => actions.setHidingAccount(null)} onConfirm={actions.confirmHide} />

      {/* Remove sheet */}
      <RemoveAccountSheet
        account={actions.removingAccount}
        onClose={() => actions.setRemovingAccount(null)}
        password={actions.removePassword}
        setPassword={actions.setRemovePassword}
        error={actions.removeError}
        setError={actions.setRemoveError}
        loading={actions.removeLoading}
        onRemove={actions.doRemove}
      />

      {/* Reveal seed sheet */}
      <SeedRevealSheet
        account={reveal.revealingAccount}
        onClose={() => reveal.setRevealingAccount(null)}
        verifyingBackup={reveal.verifyingBackup}
        biometricRevealRequired={reveal.biometricRevealRequired}
        revealedSeed={reveal.revealedSeed}
        seedVisible={reveal.seedVisible}
        onToggleSeedVisible={() => reveal.setSeedVisible((value) => !value)}
        seedCopied={reveal.seedCopied}
        seedSecsLeft={reveal.seedSecsLeft}
        onCopy={reveal.copyRevealedSeed}
        password={reveal.revealPassword}
        onPasswordChange={(value) => { reveal.setRevealPassword(value); reveal.setRevealError(""); }}
        error={reveal.revealError}
        loading={reveal.revealLoading}
        onReveal={reveal.doRevealSeed}
        backupCheck={reveal.backupCheck}
        onBackupCheckChange={(value) => { reveal.setBackupCheck(value); reveal.setBackupCheckStatus("idle"); }}
        backupCheckStatus={reveal.backupCheckStatus}
        onVerify={reveal.verifyBackupSeed}
      />

      {/* Password rotation sheet */}
      <RotatePasswordSheet
        open={admin.showRotate}
        onClose={() => admin.setShowRotate(false)}
        done={admin.rotateDone}
        oldPassword={admin.rotateOldPassword}
        setOldPassword={admin.setRotateOldPassword}
        newPassword={admin.rotateNewPassword}
        setNewPassword={admin.setRotateNewPassword}
        confirmPassword={admin.rotateConfirm}
        setConfirmPassword={admin.setRotateConfirm}
        error={admin.rotateError}
        setError={admin.setRotateError}
        loading={admin.rotateLoading}
        onSubmit={admin.doRotatePassword}
      />

      <ManageAccountSheet
        account={selectedAccount}
        onClose={closeAccountMenu}
        isActive={isActive}
        activeAccountIndex={settings.activeAccountIndex}
        sessionWallets={sessionWallets}
        balances={walletBalances}
        hideBalances={settings.hideBalances}
        onMakeActive={makeActive}
        onRename={(account) => { actions.openRename(account); closeAccountMenu(); }}
        onEditMeta={(account) => { actions.openMeta(account); closeAccountMenu(); }}
        onVerifyBackup={() => { reveal.openBackupVerification(); closeAccountMenu(); }}
        onRevealSeed={(account) => { reveal.openReveal(account); closeAccountMenu(); }}
        onToggleHide={(account) => { actions.toggleHide(account); closeAccountMenu(); }}
        onRemove={(account) => { actions.openRemove(account); closeAccountMenu(); }}
      />
    </AppShell>
  );
}
