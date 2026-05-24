import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { DONATION_IDENTITY, SPONSOR_NAMES, type Sponsor } from "@/data/sponsors";
import { truncateId } from "@/lib/format";

export const SPONSORS_QUERY_KEY = ["sponsors"] as const;

const PAGE_SIZE = 100;

function parseNameOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const parsed: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      parsed[key] = entry;
    }
  }
  return parsed;
}

function getNameOverrides(): Record<string, string> {
  return parseNameOverrides(SPONSOR_NAMES);
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

async function fetchSponsors(): Promise<Sponsor[]> {
  const [txs, nameOverrides] = await Promise.all([
    fetchAllTransactions(),
    Promise.resolve(getNameOverrides()),
  ]);

  // Accumulate all confirmed incoming transfers per sender — multiple donations add up.
  const totals = new Map<string, bigint>();
  for (const tx of txs) {
    if (tx.destination !== DONATION_IDENTITY) continue;
    if (!tx.moneyFlew) continue;
    if (!tx.source || !tx.amount) continue;
    totals.set(tx.source, (totals.get(tx.source) ?? 0n) + BigInt(tx.amount));
  }

  return [...totals.entries()]
    .sort(([, a], [, b]) => (a === b ? 0 : a > b ? -1 : 1))
    .map(([identity, amount]) => ({
      name: nameOverrides[identity] ?? truncateId(identity),
      amount,
    }));
}

export function useSponsors() {
  return useQuery({
    queryKey: SPONSORS_QUERY_KEY,
    queryFn: fetchSponsors,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });
}

export function useInvalidateSponsors() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SPONSORS_QUERY_KEY });
}
