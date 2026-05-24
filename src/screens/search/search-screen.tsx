import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Input } from "@/components/input";
import { Divider } from "@/components/divider";
import { Identicon } from "@/components/identicon";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getRpcClient } from "@/lib/rpc";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { truncateId } from "@/lib/format";
import { getAccountIdentity } from "@/lib/accounts";

type SearchSection = "accounts" | "contacts" | "transactions" | "contracts";

interface SearchResult {
  key: string;
  section: SearchSection;
  title: string;
  subtitle: string;
  identity?: string;
  onSelect: () => void;
}

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

  const txQueries = useQueries({
    queries: accountEntries.map((account) => ({
      queryKey: ["search-history", account.identity],
      enabled: !!account.identity,
      staleTime: 60_000,
      queryFn: async () => {
        const result = await getRpcClient().archive.getTransactionsForIdentity({
          identity: account.identity,
          pagination: { size: 25, offset: 0 },
        });
        if (!result.ok) return [];
        return (result.value.transactions ?? []).map((tx) => ({
          hash: tx.hash ?? "",
          source: tx.source ?? null,
          destination: tx.destination ?? null,
          amount: tx.amount ?? "0",
          accountIndex: account.accountIndex,
          vaultId: account.vaultId,
          vaultName: account.vaultName,
          identity: account.identity,
        }));
      },
    })),
  });

  const txItems = txQueries.flatMap((queryResult) => queryResult.data ?? []);

  const results = useMemo(() => {
    if (!normalizedQuery) return [] as SearchResult[];

    const accountResults: SearchResult[] = accountEntries
      .filter((account) =>
        [
          account.accountName,
          account.vaultName,
          account.identity,
          account.note,
          ...account.tags,
        ].some((part) => part.toLowerCase().includes(normalizedQuery)),
      )
      .map((account) => ({
        key: `account:${account.vaultId}:${account.accountIndex}`,
        section: "accounts",
        title: account.accountName,
        subtitle: `${account.vaultName} · ${truncateId(account.identity)}`,
        identity: account.identity,
        onSelect: () => {
          setActiveVault(account.vaultId);
          setActiveAccountIndex(account.accountIndex);
          navigate("/dashboard");
        },
      }));

    const contactResults: SearchResult[] = contacts
      .filter((contact) => [contact.name, contact.identity, contact.note].some((part) => part.toLowerCase().includes(normalizedQuery)))
      .map((contact) => ({
        key: `contact:${contact.id}`,
        section: "contacts",
        title: contact.name,
        subtitle: contact.note ? `${truncateId(contact.identity)} · ${contact.note}` : truncateId(contact.identity),
        identity: contact.identity,
        onSelect: () => navigate(`/send?to=${contact.identity}`),
      }));

    const transactionResults: SearchResult[] = txItems
      .filter((tx) => {
        const memo = txMemos[tx.hash] ?? "";
        const contractLabel =
          (tx.destination && KNOWN_CONTRACT_ADDRESSES[tx.destination]) ||
          (tx.source && KNOWN_CONTRACT_ADDRESSES[tx.source]) ||
          "";
        return [tx.hash, memo, contractLabel, tx.source ?? "", tx.destination ?? ""].some((part) => part.toLowerCase().includes(normalizedQuery));
      })
      .slice(0, 20)
      .map((tx) => ({
        key: `tx:${tx.hash}`,
        section: "transactions",
        title: txMemos[tx.hash]?.trim() || truncateId(tx.hash, 12, 12),
        subtitle: `${tx.vaultName} · ${tx.amount} QU`,
        onSelect: () => {
          setActiveVault(tx.vaultId);
          setActiveAccountIndex(tx.accountIndex);
          navigate(`/history?focus=${tx.hash}`);
        },
      }));

    const pendingResults: SearchResult[] = pendingTxs
      .filter((tx) => {
        const memo = txMemos[tx.hash] ?? "";
        return [tx.hash, memo, tx.source, tx.destination, tx.contractName ?? ""].some((part) => part.toLowerCase().includes(normalizedQuery));
      })
      .map((tx) => ({
        key: `pending:${tx.hash}`,
        section: "transactions",
        title: txMemos[tx.hash]?.trim() || truncateId(tx.hash, 12, 12),
        subtitle: `${tx.contractName ?? "Pending"} · ${tx.amount ?? "0"} QU`,
        onSelect: () => navigate(`/history?focus=${tx.hash}`),
      }));

    const contractResults: SearchResult[] = Object.entries(KNOWN_CONTRACT_ADDRESSES)
      .filter(([, name]) => name.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(name.toLowerCase()))
      .map(([identity, name]) => ({
        key: `contract:${identity}`,
        section: "contracts",
        title: name,
        subtitle: truncateId(identity),
        identity,
        onSelect: () => navigate(`/send?to=${identity}`),
      }));

    return [...accountResults, ...contactResults, ...pendingResults, ...transactionResults, ...contractResults];
  }, [accountEntries, contacts, navigate, normalizedQuery, pendingTxs, setActiveAccountIndex, setActiveVault, txItems, txMemos]);

  const grouped = useMemo(() => ({
    accounts: results.filter((result) => result.section === "accounts"),
    contacts: results.filter((result) => result.section === "contacts"),
    transactions: results.filter((result) => result.section === "transactions"),
    contracts: results.filter((result) => result.section === "contracts"),
  }), [results]);

  const statusBar = <ScreenHeader title="Search" onBack={() => navigate("/dashboard")} />;

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search contacts, accounts, tx hashes, memos, contracts"
        autoFocus
        style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)" }}
      />

      {!normalizedQuery && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [START TYPING TO SEARCH]
        </div>
      )}

      {normalizedQuery && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [NO RESULTS]
        </div>
      )}

      {(Object.entries(grouped) as Array<[SearchSection, SearchResult[]]>).map(([section, sectionResults]) => (
        sectionResults.length > 0 ? (
          <div key={section} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {section}
            </div>
            {sectionResults.map((result, index) => (
              <div key={result.key}>
                {index > 0 && <Divider style={{ marginBottom: "var(--space-3)" }} />}
                <button
                  type="button"
                  onClick={result.onSelect}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--space-3)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                >
                  <Identicon seed={result.identity ?? result.key} size={32} radius={5} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                      {result.title}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
                      {result.subtitle}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        ) : null
      ))}
    </AppShell>
  );
}
