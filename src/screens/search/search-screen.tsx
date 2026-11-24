import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Search01Icon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Input } from "@/components/input";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { listIdentityTransactions } from "@/lib/api/generated";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { getAccountIdentity } from "@/lib/accounts";
import { normalizeApiTransaction } from "@/lib/tx-domain";
import { buildSearchResults, groupSearchResults } from "./search-results";
import { SearchResults } from "./search-results-view";
import { SearchEmptyState } from "./search-empty-state";

export default function SearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const contacts = usePersistedStore((s) => s.contacts);
  const txMemos = usePersistedStore((s) => s.txMemos);
  const wallets = useSessionStore((s) => s.wallets);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const normalizedQuery = query.trim().toLowerCase();
  const accountEntries = vaults.flatMap((vault) =>
    vault.accounts.map((account) => ({
      vaultId: vault.id,
      vaultName: vault.name,
      accountIndex: account.index,
      accountName: account.name,
      identity:
        getAccountIdentity(
          account,
          vault.id === settings.activeVaultId ? (wallets[account.index] ?? null) : null,
        ) ?? account.identity ?? "",
      note: account.note ?? "",
      tags: account.tags ?? [],
    })),
  ).filter((account) => account.identity);

  const apiIdentity = useApiCacheIdentity();
  const txQueries = useQueries({
    queries: accountEntries.map((account) => ({
      queryKey: ["search-history", apiIdentity, account.identity],
      enabled: !!normalizedQuery && !!account.identity,
      staleTime: 60_000,
      queryFn: async () => {
        const { data } = await listIdentityTransactions({
          path: { identity: account.identity },
          query: { limit: 25 },
          throwOnError: true,
        });
        return data.data
          .map(normalizeApiTransaction)
          .filter((tx): tx is NonNullable<typeof tx> => !!tx)
          .map((tx) => ({
            ...tx,
            accountIndex: account.accountIndex,
            vaultId: account.vaultId,
            vaultName: account.vaultName,
            identity: account.identity,
          }));
      },
    })),
  });

  const txItems = txQueries.flatMap((queryResult) => queryResult.data ?? []);

  const results = useMemo(() => buildSearchResults({
    accounts: accountEntries,
    contacts,
    transactions: txItems,
    pendingTxs,
    txMemos,
    query: normalizedQuery,
    navigate,
    setActiveVault,
    setActiveAccountIndex,
  }), [accountEntries, contacts, navigate, normalizedQuery, pendingTxs, setActiveAccountIndex, setActiveVault, txItems, txMemos]);

  const grouped = useMemo(() => groupSearchResults(results), [results]);

  return (
    <AppShell contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ position: "relative" }}>
        <Search01Icon size={18} strokeWidth={1.5} style={{ position: "absolute", left: "var(--space-3)", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-disabled)", pointerEvents: "none", zIndex: 1 }} />
        <Input
          aria-label="Search Vault"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts, accounts, transactions, contracts"
          autoFocus
          style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", paddingLeft: "var(--space-10)" }}
        />
      </div>

      {!normalizedQuery && (
        <SearchEmptyState
          title="Start typing to search"
          description="Search accounts, contacts, transactions, or contracts"
        />
      )}

      {normalizedQuery && results.length === 0 && (
        <SearchEmptyState
          title={`No results for "${query.trim()}"`}
          description="Try a different name, identity, or hash"
        />
      )}

      <SearchResults grouped={grouped} />
    </AppShell>
  );
}
