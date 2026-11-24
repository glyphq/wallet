import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Identicon } from "@/components/identicon";
import { IdentityDisplay } from "@/components/identity-display";
import { Input } from "@/components/input";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { getAccountIdentity, parseAccountTags } from "@/lib/accounts";
import { formatQu } from "@/lib/format";
import { removeFromWallet, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
          {title}
        </span>
        {description ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)", lineHeight: "var(--leading-body)" }}>
            {description}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

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
  const [confirmHide, setConfirmHide] = useState(false);
  const [password, setPassword] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => {
    setName(account?.name ?? "");
    setTags((account?.tags ?? []).join(", "));
    setNote(account?.note ?? "");
    setSaved(false);
    setConfirmHide(false);
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

  function makeActive() {
    if (!account || account.hidden) return;
    setActiveAccountIndex(account.index);
  }

  function hideAccount() {
    if (!wallet || !account) return;
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((item) =>
        item.index === account.index ? { ...item, hidden: true } : item,
      ),
    });
    setConfirmHide(false);
  }

  function unhideAccount() {
    if (!wallet || !account) return;
    updateWallet(wallet.id, {
      accounts: wallet.accounts.map((item) =>
        item.index === account.index ? { ...item, hidden: false } : item,
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
    <AppShell
      contentStyle={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        maxWidth: 720,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <Identicon kind="account" code={`A${account.index + 1}`} seed={identity ?? account.name} label={account.name} size={48} radius={10} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {account.name}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.05em" }}>
            ACCOUNT {account.index + 1}
            {isCurrent ? " · ACTIVE" : ""}
            {account.hidden ? " · HIDDEN" : ""}
          </span>
        </div>
        {balance !== null && balance !== undefined ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-display)", flexShrink: 0 }}>
            {settings.hideBalances ? "••••••" : `${formatQu(balance)} QU`}
          </span>
        ) : null}
      </header>

      {identity ? <IdentityDisplay identity={identity} showIdenticon={false} /> : null}

      <Section title="Selection" description={account.hidden ? "Hidden accounts cannot be made active." : "Use this account for sending, receiving, and signing."}>
        <Button variant={isCurrent ? "secondary" : "primary"} size="md" style={{ width: "100%" }} disabled={isCurrent || account.hidden} onClick={makeActive}>
          {isCurrent ? "Active account" : "Use this account"}
        </Button>
      </Section>

      <Section title="Details" description="The name, tags, and note are stored locally with the wallet.">
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
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Button size="md" style={{ width: "100%" }} disabled={!name.trim()} onClick={saveDetails}>
              Save changes
            </Button>
            {saved ? (
              <span aria-live="polite" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-success)", letterSpacing: "0.05em", flexShrink: 0 }}>
                Saved
              </span>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Visibility" description="Hidden accounts stay in the wallet but are removed from the header switcher.">
        {account.hidden ? (
          <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={unhideAccount}>
            Unhide account
          </Button>
        ) : confirmHide ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-body)" }}>
              Hide <strong style={{ color: "var(--color-text-primary)" }}>{account.name}</strong> from the account switcher?
            </span>
            <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={hideAccount}>
              Hide account
            </Button>
            <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => setConfirmHide(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="md" style={{ width: "100%" }} disabled={isCurrent} onClick={() => setConfirmHide(true)}>
            {isCurrent ? "Switch accounts before hiding this one" : "Hide account"}
          </Button>
        )}
      </Section>

      <Section
        title="Danger zone"
        description={lastAccount
          ? "A wallet must keep at least one account. Add another account before removing this one."
          : "Removing an account deletes its seed from this wallet. This cannot be undone."}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Input
            type="password"
            label="Wallet password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setRemoveError("");
            }}
            error={removeError}
            placeholder="••••••••••"
            autoComplete="current-password"
            disabled={lastAccount}
          />
          <Button
            variant="danger"
            size="md"
            style={{ width: "100%" }}
            disabled={lastAccount || !password || removeLoading}
            loading={removeLoading}
            onClick={() => void removeAccount()}
          >
            Remove account
          </Button>
        </div>
      </Section>
    </AppShell>
  );
}
