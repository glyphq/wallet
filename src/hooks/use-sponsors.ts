import { useQuery } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { DONATION_IDENTITY, SPONSOR_NAMES_URL, type Sponsor } from "@/data/sponsors";

const PAGE_SIZE = 100;

async function fetchSponsors(): Promise<Sponsor[]> {
  const [txPages, nameOverrides] = await Promise.all([
    fetchAllTransactions(),
    fetchNameOverrides(),
  ]);

  const totals = new Map<string, number>();
  for (const tx of txPages) {
    if (tx.destination !== DONATION_IDENTITY) continue;
    if (!tx.moneyFlew) continue;
    if (!tx.source || !tx.amount) continue;
    totals.set(tx.source, (totals.get(tx.source) ?? 0) + Number(tx.amount));
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([identity, amount]) => ({
      name: nameOverrides[identity] ?? truncate(identity),
      amount,
    }));
}

async function fetchAllTransactions() {
  const client = getRpcClient();
  const all: { source?: string; destination?: string; amount?: string; moneyFlew?: boolean }[] = [];
  let offset = 0;
  while (true) {
    const result = await client.archive.getTransactionsForIdentity({
      identity: DONATION_IDENTITY,
      pagination: { size: PAGE_SIZE, offset },
    });
    if (!result.ok) break;
    const page = result.value.transactions;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

async function fetchNameOverrides(): Promise<Record<string, string>> {
  try {
    const res = await fetch(SPONSOR_NAMES_URL);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function truncate(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}

export function useSponsors() {
  return useQuery({
    queryKey: ["sponsors"],
    queryFn: fetchSponsors,
    staleTime: 5 * 60 * 1000, // 5 min — fresh enough, not hammering the API
    gcTime: 10 * 60 * 1000,
  });
}
