import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import type { Contact } from "@/store/persisted";

export interface AddressSuggestion {
  identity: string;
  label: string;
  secondary: string;
  kind: "contact" | "account" | "contract" | "recent";
  rank: number;
}

export interface AddressSuggestionAccount {
  name: string;
  identity: string;
  note?: string;
  tags?: string[];
}

export function getRecentRecipientIdentities(identity: string | null, txs?: Array<{ source: string | null; destination: string | null }>): string[] {
  if (!identity || !txs) return [];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const tx of txs) {
    const counterparty = tx.source === identity ? tx.destination : tx.destination === identity ? tx.source : null;
    if (!counterparty || seen.has(counterparty)) continue;
    seen.add(counterparty);
    results.push(counterparty);
  }

  return results;
}

export function buildAddressSuggestions({
  query,
  contacts,
  accounts,
  currentIdentity,
  recentIdentities,
}: {
  query: string;
  contacts: Contact[];
  accounts: AddressSuggestionAccount[];
  currentIdentity?: string | null;
  recentIdentities?: string[];
}): AddressSuggestion[] {
  const needle = query.trim().toLowerCase();
  const byIdentity = new Map<string, AddressSuggestion>();

  function matches(parts: string[]): boolean {
    if (!needle) return true;
    return parts.some((part) => part.toLowerCase().includes(needle));
  }

  function score(identity: string, label: string, bonus: number): number {
    if (!needle) return bonus;
    const idLower = identity.toLowerCase();
    const labelLower = label.toLowerCase();
    if (idLower.startsWith(needle) || labelLower.startsWith(needle)) return bonus + 100;
    if (idLower.includes(needle) || labelLower.includes(needle)) return bonus + 50;
    return bonus;
  }

  function addSuggestion(next: Omit<AddressSuggestion, "rank">, bonus: number) {
    if (!next.identity || next.identity === currentIdentity) return;
    if (!matches([next.label, next.secondary, next.identity])) return;
    const ranked: AddressSuggestion = { ...next, rank: score(next.identity, next.label, bonus) };
    const existing = byIdentity.get(next.identity);
    if (!existing || ranked.rank > existing.rank) byIdentity.set(next.identity, ranked);
  }

  contacts.forEach((contact) => {
    addSuggestion(
      {
        identity: contact.identity,
        label: contact.name,
        secondary: contact.note || "Contact",
        kind: "contact",
      },
      300 + Math.floor(contact.lastUsedAt / 1_000_000_000_000),
    );
  });

  accounts.forEach((account) => {
    addSuggestion(
      {
        identity: account.identity,
        label: account.name,
        secondary: [account.note, ...(account.tags ?? []).map((tag) => `#${tag}`)].filter(Boolean).join(" · ") || "Vault account",
        kind: "account",
      },
      200,
    );
  });

  recentIdentities?.forEach((identity, index) => {
    addSuggestion(
      {
        identity,
        label: KNOWN_CONTRACT_ADDRESSES[identity] ?? "Recent recipient",
        secondary: "Recent recipient",
        kind: "recent",
      },
      150 - index,
    );
  });

  Object.entries(KNOWN_CONTRACT_ADDRESSES).forEach(([identity, name]) => {
    addSuggestion(
      {
        identity,
        label: name,
        secondary: "Known contract",
        kind: "contract",
      },
      100,
    );
  });

  return [...byIdentity.values()].sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label)).slice(0, 6);
}
