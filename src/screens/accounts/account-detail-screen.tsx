import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { FramedAvatar } from "@/components/framed-avatar";
import { IdentityDisplay } from "@/components/identity-display";
import { Input } from "@/components/input";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { getAccountIdentity, parseAccountTags } from "@/lib/accounts";
import { formatQu } from "@/lib/format";
import { removeFromWallet, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

export default function AccountDetailScreen() {
  const navigate = useNavigate();
  const params = useParams<{ index: string }>();
  const [searchParams] = useSearchParams();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const updateWallet = usePersistedStore((s) => s.updateWallet);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const sessionAccounts = useSessionStore((s) => s.accounts);
  const sessionUnlock = useSessionStore((s) => s.unlock);
  const { data: balances } = useWalletBalances();

  const walletId = searchParams.get("wallet");
  const wallet = wallets.find((item) => item.id === walletId)
    ?? wallets.find((item) => item.id === settings.activeWalletId)
    ?? wallets[0]
    ?? null;
  const parsedIndex = Number(params.index);
  const account = wallet?.accounts.find((item) => item.index === parsedIndex) ?? null;
  const isActiveWallet = wallet?.id === settings.activeWalletId;
  const isCurrent = Boolean(account && isActiveWallet && settings.activeAccountIndex === account.index);
  const identity = account ? getAccountIdentity(account, sessionAccounts[account.index] ?? null) : null;
  const balance = isActiveWallet && identity ? balances?.[identity] : null;

  const [name, setName] = useState(account?.name ?? "");
  const [tags, setTags] = useState((account?.tags ?? []).join(", "));
  const [note, setNote] = useState(account?.note ?? "");
  const [saved, setSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [password, setPassword] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => {
    setName(account?.name ?? "");
    setTags((account?.tags ?? []).join(", "));
    setNote(account?.note ?? "");
    setSaved(false);
    setConfirmRemove(false);
    setPassword("");
    setRemoveError("");
    // Reset the form when navigating between account indices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.index]);

  function markDirty() {
    if (saved) setSaved(false);
  }

  function saveDetails() {
    if (!wallet || !account || !name.trim()) return;
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((item) =>
        item.index === account.index
          ? { ...item, name: name.trim(), note: note.trim(), tags: parseAccountTags(tags) }
          : item,
      ),
    });
    setSaved(true);
  }

  function toggleVisibility() {
    if (!wallet || !account) return;
    if (!account.hidden && isCurrent) return;
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((item) =>
        item.index === account.index ? { ...item, hidden: !item.hidden } : item,
      ),
    });
  }

  async function removeAccount() {
    if (!wallet || !wallet.encryptedData || !account || removeLoading) return;
    if (wallet.accounts.length <= 1) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      const newEncrypted = await removeFromWallet(wallet.encryptedData, password, account.index);
      const updatedAccounts = wallet.accounts
        .filter((item) => item.index !== account.index)
        .map((item) => ({ ...item, index: item.index > account.index ? item.index - 1 : item.index }));
      updateWallet(wallet.id, { encryptedData: newEncrypted, accounts: updatedAccounts });
      if (isActiveWallet) {
        const accounts = await unlockWalletSession(newEncrypted, password);
        sessionUnlock(wallet.id, accounts);
        if (account.index === settings.activeAccountIndex) {
          setActiveAccountIndex(0);
        } else if (account.index < settings.activeAccountIndex) {
          setActiveAccountIndex(settings.activeAccountIndex - 1);
        }
      }
      navigate(`/accounts?wallet=${wallet.id}`, { replace: true });
    } catch {
      setRemoveError("Wrong password");
    } finally {
      setRemoveLoading(false);
    }
  }

  if (!wallet || !account) {
    return (
      <AppShell contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-3)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Account not found
        </span>
        <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--text-body-compact)", textAlign: "center" }}>
          This account may have already been removed.
        </p>
        <Button variant="secondary" size="md" style={{ width: "auto" }} onClick={() => navigate("/accounts", { replace: true })}>
          Back to accounts
        </Button>
      </AppShell>
    );
  }

  const lastAccount = wallet.accounts.length <= 1;

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <FramedAvatar seed={identity ?? account.name} size={48} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {account.name}
            </span>
            {isCurrent || account.hidden ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.05em" }}>
                {isCurrent ? "ACTIVE" : ""}
                {isCurrent && account.hidden ? " · " : ""}
                {account.hidden ? "HIDDEN" : ""}
              </span>
            ) : null}
          </div>
          {balance !== null && balance !== undefined ? (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-display)", flexShrink: 0 }}>
              {settings.hideBalances ? "••••••" : `${formatQu(balance)} QU`}
            </span>
          ) : null}
        </header>

        {identity ? <IdentityDisplay identity={identity} showIdenticon={false} /> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Input
            label="Name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              markDirty();
            }}
            maxLength={80}
            style={{ fontFamily: "var(--font-sans)" }}
          />
          <Input
            label="Tags"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              markDirty();
            }}
            placeholder="staking, cold, treasury"
            maxLength={160}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
              Note
            </span>
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                markDirty();
              }}
              rows={4}
              maxLength={2000}
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
        </div>
      </div>

      <footer style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--space-4) var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%", maxWidth: 720, margin: "0 auto" }}>
          {confirmRemove ? (
            <>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)", color: "var(--color-status-error)" }}>
                Removing deletes this account seed from {wallet.name}. This cannot be undone.
              </span>
              <Input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setRemoveError("");
                }}
                error={removeError}
                placeholder="Wallet password"
                autoComplete="current-password"
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <Button
                  variant="danger"
                  size="md"
                  style={{ flex: "1 1 140px" }}
                  loading={removeLoading}
                  disabled={!password}
                  onClick={() => void removeAccount()}
                >
                  Remove account
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  style={{ flex: "1 1 120px" }}
                  disabled={removeLoading}
                  onClick={() => {
                    setConfirmRemove(false);
                    setPassword("");
                    setRemoveError("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button size="md" style={{ width: "100%" }} disabled={!name.trim()} onClick={saveDetails}>
                {saved ? "Saved" : "Save changes"}
              </Button>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <Button
                  variant="secondary"
                  size="md"
                  style={{ flex: "1 1 140px" }}
                  disabled={!account.hidden && isCurrent}
                  title={!account.hidden && isCurrent ? "Switch accounts before hiding this one" : undefined}
                  onClick={toggleVisibility}
                >
                  {account.hidden ? "Unhide account" : "Hide account"}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  style={{ flex: "1 1 140px" }}
                  disabled={lastAccount}
                  onClick={() => setConfirmRemove(true)}
                >
                  Remove account
                </Button>
              </div>
            </>
          )}
        </div>
      </footer>
    </AppShell>
  );
}
