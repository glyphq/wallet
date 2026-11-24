import type { ReactNode } from "react";
import { User02Icon, UserGroupIcon, Exchange01Icon, File01Icon } from "@/lib/icons";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { truncateId } from "@/lib/format";
import { getKnownContractLabel, pendingTxToRecord } from "@/lib/tx-domain";
import type { Contact, PendingTx } from "@/store/persisted";

export const SECTION_ICONS: Record<string, React.ReactNode> = {
  accounts: <User02Icon size={14} strokeWidth={1.5} />,
  contacts: <UserGroupIcon size={14} strokeWidth={1.5} />,
  transactions: <Exchange01Icon size={14} strokeWidth={1.5} />,
  contracts: <File01Icon size={14} strokeWidth={1.5} />,
};

export const SECTION_LABELS: Record<string, string> = {
  accounts: "Accounts",
  contacts: "Contacts",
  transactions: "Transactions",
  contracts: "Contracts",
};

export type SearchSection = "accounts" | "contacts" | "transactions" | "contracts";

export interface SearchResult {
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

export interface SearchAccountEntry {
  walletId: string;
  walletName: string;
  accountIndex: number;
  accountName: string;
  identity: string;
  note: string;
  tags: string[];
}

export interface SearchTxItem {
  hash: string;
  amount: string;
  source?: string | null;
  destination?: string | null;
  walletId: string;
  walletName: string;
  accountIndex: number;
}

interface SearchResultSources {
  accounts: SearchAccountEntry[];
  contacts: Contact[];
  transactions: SearchTxItem[];
  pendingTxs: PendingTx[];
  txMemos: Record<string, string>;
}

interface SearchResultActions {
  navigate: (path: string) => void;
  setActiveWallet: (id: string | null) => void;
  setActiveAccountIndex: (index: number) => void;
}

type SearchResultInput = SearchResultSources & SearchResultActions & { query: string };

export function buildSearchResults({
  accounts,
  contacts,
  transactions,
  pendingTxs,
  txMemos,
  query,
  navigate,
  setActiveWallet,
  setActiveAccountIndex,
}: SearchResultInput): SearchResult[] {
  if (!query) return [];

  const accountResults: SearchResult[] = accounts
    .filter((account) =>
      [
        account.accountName,
        account.walletName,
        account.identity,
        account.note,
        ...account.tags,
      ].some((part) => part.toLowerCase().includes(query)),
    )
    .map((account) => ({
      key: `account:${account.walletId}:${account.accountIndex}`,
      section: "accounts",
      title: account.accountName,
      subtitle: `${account.walletName} · ${truncateId(account.identity)}`,
      identity: account.identity,
      badgeKind: "account",
      badgeCode: `A${account.accountIndex + 1}`,
      onSelect: () => {
        setActiveWallet(account.walletId);
        setActiveAccountIndex(account.accountIndex);
        navigate("/dashboard");
      },
    }));

  const contactResults: SearchResult[] = contacts
    .filter((contact) => [contact.name, contact.identity, contact.note].some((part) => part.toLowerCase().includes(query)))
    .map((contact) => ({
      key: `contact:${contact.id}`,
      section: "contacts",
      title: contact.name,
      subtitle: contact.note ? `${truncateId(contact.identity)} · ${contact.note}` : truncateId(contact.identity),
      identity: contact.identity,
      badgeKind: "contact",
      onSelect: () => navigate(`/send?to=${contact.identity}`),
    }));

  const transactionResults: SearchResult[] = transactions
    .filter((tx) => {
      const memo = txMemos[tx.hash] ?? "";
      const contractLabel = getKnownContractLabel(tx.destination) || getKnownContractLabel(tx.source);
      return [tx.hash, memo, contractLabel, tx.source ?? "", tx.destination ?? ""].some((part) => part.toLowerCase().includes(query));
    })
    .slice(0, 20)
    .map((tx) => ({
      key: `tx:${tx.hash}`,
      section: "transactions",
      title: txMemos[tx.hash]?.trim() || truncateId(tx.hash, 12, 12),
      subtitle: `${tx.walletName} · ${tx.amount} QU`,
      onSelect: () => {
        setActiveWallet(tx.walletId);
        setActiveAccountIndex(tx.accountIndex);
        navigate(`/history?focus=${tx.hash}`);
      },
    }));

  const pendingResults: SearchResult[] = pendingTxs
    .map((tx) => ({ persisted: tx, record: pendingTxToRecord(tx) }))
    .filter(({ persisted, record }) => {
      const memo = txMemos[persisted.hash] ?? "";
      return [record.hash, memo, record.source ?? "", record.destination ?? "", record.contractName ?? ""].some((part) => part.toLowerCase().includes(query));
    })
    .map(({ persisted, record }) => ({
      key: `pending:${record.hash}`,
      section: "transactions",
      title: txMemos[persisted.hash]?.trim() || truncateId(record.hash, 12, 12),
      subtitle: `${record.contractName ?? "Pending"} · ${record.amount} QU`,
      onSelect: () => navigate(`/history?focus=${record.hash}`),
    }));

  const contractResults: SearchResult[] = Object.entries(KNOWN_CONTRACT_ADDRESSES)
    .filter(([, name]) => name.toLowerCase().includes(query) || query.includes(name.toLowerCase()))
    .map(([identity, name]) => ({
      key: `contract:${identity}`,
      section: "contracts",
      title: name,
      subtitle: truncateId(identity),
      identity,
      badgeKind: "contract",
      badgeIcon: <File01Icon size={16} strokeWidth={1.5} aria-hidden="true" />,
      onSelect: () => navigate(`/send?to=${identity}`),
    }));

  return [...accountResults, ...contactResults, ...pendingResults, ...transactionResults, ...contractResults];
}

export function groupSearchResults(results: SearchResult[]): Record<SearchSection, SearchResult[]> {
  return {
    accounts: results.filter((result) => result.section === "accounts"),
    contacts: results.filter((result) => result.section === "contacts"),
    transactions: results.filter((result) => result.section === "transactions"),
    contracts: results.filter((result) => result.section === "contracts"),
  };
}
