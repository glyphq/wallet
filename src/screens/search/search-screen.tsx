import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UserRounded, UsersGroupRounded, TransferHorizontal, Document, Magnifier } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Input } from "@/components/input";
import { Divider } from "@/components/divider";
import { Identicon } from "@/components/identicon";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getRpcClient } from "@/lib/rpc";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { truncateId } from "@/lib/format";
import { getAccountIdentity } from "@/lib/accounts";
import { getKnownContractLabel, normalizeArchiveTransaction, pendingTxToRecord } from "@/lib/tx-domain";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  accounts: <UserRounded size={14} weight="Linear" />,
  contacts: <UsersGroupRounded size={14} weight="Linear" />,
  transactions: <TransferHorizontal size={14} weight="Linear" />,
  contracts: <Document size={14} weight="Linear" />,
};

const SECTION_LABELS: Record<string, string> = {
  accounts: "Accounts",
  contacts: "Contacts",
  transactions: "Transactions",
  contracts: "Contracts",
};

type SearchSection = "accounts" | "contacts" | "transactions" | "contracts";

interface SearchResult {
  key: string;
  section: SearchSection;
  title: string;
  subtitle: string;
  identity?: string;
  badgeKind?: "account" | "contact" | "contract" | "identity";
  badgeCode?: string;
  badgeIcon?: ReactNode;
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
      enabled: !!normalizedQuery && !!account.identity,
      staleTime: 60_000,
      queryFn: async () => {
        const result = await getRpcClient().archive.getTransactionsForIdentity({
          identity: account.identity,
          pagination: { size: 25, offset: 0 },
        });
        if (!result.ok) return [];
        return (result.value.transactions ?? [])
          .map(normalizeArchiveTransaction)
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
        badgeKind: "account",
        badgeCode: `A${account.accountIndex + 1}`,
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
        badgeKind: "contact",
        onSelect: () => navigate(`/send?to=${contact.identity}`),
      }));

    const transactionResults: SearchResult[] = txItems
      .filter((tx) => {
        const memo = txMemos[tx.hash] ?? "";
        const contractLabel = getKnownContractLabel(tx.destination) || getKnownContractLabel(tx.source);
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
      .map((tx) => ({ persisted: tx, record: pendingTxToRecord(tx) }))
      .filter(({ persisted, record }) => {
        const memo = txMemos[persisted.hash] ?? "";
        return [record.hash, memo, record.source ?? "", record.destination ?? "", record.contractName ?? ""].some((part) => part.toLowerCase().includes(normalizedQuery));
      })
      .map(({ persisted, record }) => ({
        key: `pending:${record.hash}`,
        section: "transactions",
        title: txMemos[persisted.hash]?.trim() || truncateId(record.hash, 12, 12),
        subtitle: `${record.contractName ?? "Pending"} · ${record.amount} QU`,
        onSelect: () => navigate(`/history?focus=${record.hash}`),
      }));

    const contractResults: SearchResult[] = Object.entries(KNOWN_CONTRACT_ADDRESSES)
      .filter(([, name]) => name.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(name.toLowerCase()))
      .map(([identity, name]) => ({
        key: `contract:${identity}`,
        section: "contracts",
        title: name,
        subtitle: truncateId(identity),
        identity,
        badgeKind: "contract",
        badgeIcon: <Document size={16} weight="Linear" aria-hidden="true" />,
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

  return (
    <AppShell contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ position: "relative" }}>
        <Magnifier size={18} weight="Linear" style={{ position: "absolute", left: "var(--space-3)", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-disabled)", pointerEvents: "none", zIndex: 1 }} />
        <Input
          aria-label="Search wallet"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts, accounts, transactions, contracts"
          autoFocus
          style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", paddingLeft: "var(--space-10)" }}
        />
      </div>

      {!normalizedQuery && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <Magnifier size={48} weight="Linear" style={{ color: "var(--color-text-disabled)", opacity: 0.5 }} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
            Start typing to search
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", opacity: 0.7 }}>
            Search accounts, contacts, transactions, or contracts
          </div>
        </div>
      )}

      {normalizedQuery && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <Magnifier size={48} weight="Linear" style={{ color: "var(--color-text-disabled)", opacity: 0.5 }} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
            No results for "{query.trim()}"
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", opacity: 0.7 }}>
            Try a different name, identity, or hash
          </div>
        </div>
      )}

      {(Object.entries(grouped) as Array<[SearchSection, SearchResult[]]>).map(([section, sectionResults]) => (
        sectionResults.length > 0 ? (
          <div key={section} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-disabled)" }}>
              <span style={{ flexShrink: 0 }}>{SECTION_ICONS[section]}</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500 }}>
                {SECTION_LABELS[section]}
              </span>
            </div>
            {sectionResults.map((result, index) => (
              <div key={result.key} className="stagger-item">
                {index > 0 && <Divider style={{ marginBottom: "var(--space-3)" }} />}
                <button
                  type="button"
                  onClick={result.onSelect}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--space-3)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                >
                  <Identicon kind={result.badgeKind ?? "identity"} code={result.badgeCode} icon={result.badgeIcon} seed={result.identity ?? result.key} label={result.title} size={32} radius={8} style={{ flexShrink: 0 }} />
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
