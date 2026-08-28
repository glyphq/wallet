import { useQuery } from "@tanstack/react-query";
import { usePollingIntervalMs } from "@/hooks/use-polling-profile";
import { usePersistedStore } from "@/store/persisted";
import type { DisplayCurrency } from "@/lib/format";
import { parseCoinbaseUsdRate } from "@/lib/preferred-currency-quote";

const EUR_RATES_URL = "https://api.coinbase.com/v2/exchange-rates?currency=EUR";
const BTC_RATES_URL = "https://api.coinbase.com/v2/exchange-rates?currency=BTC";

export interface PreferredCurrencyQuote {
  currency: DisplayCurrency;
  eurUsdRate: number | null;
  btcUsdRate: number | null;
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function fetchUsdRate(url: string, currency: "EUR" | "BTC"): Promise<number> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("quote fetch failed");
  const rate = parseCoinbaseUsdRate(await res.json(), currency);
  if (!rate) throw new Error("quote response invalid");
  return rate;
}

export function usePreferredCurrencyQuote(): PreferredCurrencyQuote {
  const currency = usePersistedStore((s) => s.settings.currency);
  const pollingIntervalMs = usePollingIntervalMs();
  const refetchInterval = Math.max(60_000, pollingIntervalMs);
  const enabled = currency === "EUR" || currency === "BTC";

  const query = useQuery({
    queryKey: ["preferred-currency-quote", currency],
    queryFn: () => currency === "EUR" ? fetchUsdRate(EUR_RATES_URL, "EUR") : fetchUsdRate(BTC_RATES_URL, "BTC"),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchInterval: enabled ? refetchInterval : false,
    refetchIntervalInBackground: false,
  });

  return {
    currency,
    eurUsdRate: currency === "EUR" && finitePositive(query.data) ? query.data : null,
    btcUsdRate: currency === "BTC" && finitePositive(query.data) ? query.data : null,
  };
}
