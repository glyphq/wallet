import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { PageFrame } from "@/components/page-header";
import { MAX_WALLET_ACCOUNTS } from "@/hooks/use-wallet-balances";
import { deriveIdentityFromSeed, generateRandomSeed, InvalidSeedError, toSeed, type Seed } from "@/lib/crypto";
import { addToWallet, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore, type AccountMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const ACCOUNT_NAME_SUGGESTIONS = [
  "Main", "Trading", "Staking", "Cold Storage", "DeFi", "Savings",
  "Hot Wallet", "Treasury", "Operations", "Rewards",
];

const FORM_ID = "account-add-form";

export default function AccountAddScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const updateWallet = usePersistedStore((s) => s.updateWallet);
  const sessionUnlock = useSessionStore((s) => s.unlock);

  const walletId = searchParams.get("wallet");
  const wallet = wallets.find((item) => item.id === walletId)
    ?? wallets.find((item) => item.id === settings.activeWalletId)
    ?? wallets[0]
    ?? null;
  const isActive = wallet?.id === settings.activeWalletId;

  const [mode, setMode] = useState<"new" | "import">("new");
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [seedError, setSeedError] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const atLimit = (wallet?.accounts.length ?? 0) >= MAX_WALLET_ACCOUNTS;
  const canSubmit = Boolean(wallet?.encryptedData) && !atLimit && name.trim().length > 0
    && password.length > 0 && (mode === "new" || seed.trim().length > 0);

  function changeMode(nextMode: "new" | "import") {
    setMode(nextMode);
    setSeed("");
    setSeedError("");
    setError("");
  }

  function suggestedNames(): string[] {
    const existing = new Set(wallet?.accounts.map((account) => account.name.toLowerCase()) ?? []);
    const query = name.toLowerCase();
    return ACCOUNT_NAME_SUGGESTIONS.filter(
      (suggestion) => !existing.has(suggestion.toLowerCase()) && (!query || suggestion.toLowerCase().includes(query)),
    ).slice(0, 4);
  }

  async function submit() {
    if (!wallet || !wallet.encryptedData || !canSubmit || loading) return;
    setSeedError("");
    setError("");

    let seedToAdd: Seed | null = null;
    if (mode === "import") {
      try {
        seedToAdd = toSeed(seed.trim().toLowerCase());
      } catch (cause) {
        setSeedError(cause instanceof InvalidSeedError ? "55 lowercase letters required" : "Invalid seed");
        return;
      }
    }

    setLoading(true);
    try {
      const newSeed = seedToAdd ?? generateRandomSeed();
      const newEncrypted = await addToWallet(wallet.encryptedData, password, newSeed);
      const newIndex = wallet.accounts.length;
      const newAccount: AccountMeta = {
        index: newIndex,
        name: name.trim(),
        addedAt: Date.now(),
        identity: deriveIdentityFromSeed(newSeed),
        note: "",
      };
      updateWallet(wallet.id, {
        encryptedData: newEncrypted,
        accounts: [...wallet.accounts, newAccount],
      });
      if (isActive) {
        const accounts = await unlockWalletSession(newEncrypted, password);
        sessionUnlock(wallet.id, accounts);
      }
      navigate(`/accounts/${newIndex}?wallet=${wallet.id}`, { replace: true });
    } catch {
      setError("Wrong password");
    } finally {
      setLoading(false);
    }
  }

  if (!wallet || atLimit) {
    return (
      <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
        <PageFrame
          actions={<Button variant="secondary" style={{ width: "100%" }} onClick={() => navigate("/accounts", { replace: true })}>Back to accounts</Button>}
        >
          <div style={{ maxWidth: 420, margin: "auto", textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {wallet ? "Account limit reached" : "Wallet not found"}
            </span>
            <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-body-compact)" }}>
              {wallet
                ? `This wallet already holds the maximum of ${MAX_WALLET_ACCOUNTS} accounts.`
                : "The wallet for this account could not be found."}
            </p>
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  const suggestions = suggestedNames();

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <PageFrame
        actions={(
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Button type="submit" form={FORM_ID} size="md" style={{ width: "100%" }} loading={loading} disabled={!canSubmit}>
              Add account
            </Button>
            <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => navigate("/accounts")}>
              Cancel
            </Button>
          </div>
        )}
      >
        <form
          id={FORM_ID}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
              Account type
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              {(["new", "import"] as const).map((nextMode, index) => (
                <div key={nextMode} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  {index > 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>/</span>
                  )}
                  <button
                    type="button"
                    onClick={() => changeMode(nextMode)}
                    aria-pressed={mode === nextMode}
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-mono-sm)",
                      letterSpacing: "0.05em",
                      color: mode === nextMode ? "var(--color-text-display)" : "var(--color-text-disabled)",
                    }}
                  >
                    {nextMode === "new" ? "New seed" : "Import seed"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Input
              label="Account name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. DeFi, Staking"
              autoFocus
              autoComplete="off"
              maxLength={80}
              style={{ fontFamily: "var(--font-sans)" }}
            />
            {suggestions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setName(suggestion)}
                    style={{
                      background: "none",
                      border: "1px solid var(--color-border-strong)",
                      borderRadius: "var(--radius-sharp)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-mono-sm)",
                      color: "var(--color-text-disabled)",
                      letterSpacing: "0.05em",
                      padding: "2px var(--space-2)",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mode === "import" && (
            <Input
              label="Seed (55 lowercase letters)"
              type="password"
              value={seed}
              onChange={(event) => {
                setSeed(event.target.value);
                if (seedError) setSeedError("");
              }}
              error={seedError}
              placeholder="55 characters, lowercase"
              autoComplete="off"
              spellCheck={false}
            />
          )}

          <Input
            type="password"
            label="Wallet password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit && !loading) void submit();
            }}
            error={error}
            placeholder="••••••••••"
            autoComplete="current-password"
          />

          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)", lineHeight: "var(--leading-body)" }}>
            The wallet password decrypts the wallet once to append this account. The new seed is encrypted before it is written to disk.
          </p>
        </form>
      </PageFrame>
    </AppShell>
  );
}
