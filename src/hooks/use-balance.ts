import { useWalletBalances } from "@/hooks/use-wallet-balances";

/** Returns the balance for a single identity, drawn from the shared wallet-wide getBalances16 poll. */
export function useBalance(identity: string | null | undefined) {
  const { data: balances, isLoading, isError, error } = useWalletBalances();
  const balance = identity ? (balances?.[identity] ?? null) : null;

  return {
    data: balance !== null ? { balance } : undefined,
    isLoading: !!identity && isLoading,
    isError,
    error,
  };
}
