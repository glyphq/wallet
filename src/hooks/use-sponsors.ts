import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRpcClient } from "@/lib/rpc";
import { DONATION_IDENTITY, SPONSOR_NAMES, type SponsorTransparencyData } from "@/data/sponsors";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";
import { truncateId } from "@/lib/format";

export const SPONSORS_QUERY_KEY = ["sponsors"] as const;
export const sponsorsQueryKey = (rpcIdentity: string) => [...SPONSORS_QUERY_KEY, rpcIdentity] as const;

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
  const all: { hash?: string; source?: string; destination?: string; amount?: string; moneyFlew?: boolean; timestamp?: string | number | null }[] = [];
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

async function fetchSponsors(): Promise<SponsorTransparencyData> {
  const [txs, nameOverrides] = await Promise.all([
    fetchAllTransactions(),
    Promise.resolve(getNameOverrides()),
  ]);

  // Accumulate all confirmed incoming transfers per sender — multiple donations add up.
  const totals = new Map<string, bigint>();
  const latestSeenAt = new Map<string, number>();
  const donations = [];
  for (const tx of txs) {
    if (tx.destination !== DONATION_IDENTITY) continue;
    if (!tx.moneyFlew) continue;
    if (!tx.source || !tx.amount || !tx.hash) continue;
    totals.set(tx.source, (totals.get(tx.source) ?? 0n) + BigInt(tx.amount));
    const timestamp = tx.timestamp != null ? Number(tx.timestamp) : null;
    if (timestamp !== null) latestSeenAt.set(tx.source, Math.max(latestSeenAt.get(tx.source) ?? 0, timestamp));
    donations.push({
      hash: tx.hash,
      source: tx.source,
      amount: BigInt(tx.amount),
      timestamp,
    });
  }

  const sponsors = [...totals.entries()]
    .sort(([, a], [, b]) => (a === b ? 0 : a > b ? -1 : 1))
    .map(([identity, amount]) => ({
      identity,
      name: nameOverrides[identity] ?? truncateId(identity),
      amount,
    }));

  const latestContributors = [...sponsors]
    .sort((a, b) => (latestSeenAt.get(b.identity) ?? 0) - (latestSeenAt.get(a.identity) ?? 0))
    .slice(0, 8);

  return {
    sponsors,
    latestContributors,
    donations: donations.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 50),
  };
}

export function useSponsors() {
  const rpcIdentity = useRpcCacheIdentity("archive");

  return useQuery({
    queryKey: sponsorsQueryKey(rpcIdentity),
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
