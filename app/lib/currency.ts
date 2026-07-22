export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "TRY"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

type RateResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

let cachedRates: { base: string; fetchedAt: number; rates: Record<string, number> } | null = null;
const RATE_CACHE_MS = 60 * 60 * 1000;
const RATE_TIMEOUT_MS = 4_000;

export async function convertCurrency(amount: number, from: string, to: SupportedCurrency) {
  if (!Number.isFinite(amount) || !from || from === to) {
    return { value: from === to ? amount : null, timestamp: null };
  }

  const base = from.toUpperCase();
  const now = Date.now();
  try {
    if (!cachedRates || cachedRates.base !== base || now - cachedRates.fetchedAt > RATE_CACHE_MS) {
      const response = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${to}`, {
        signal: AbortSignal.timeout(RATE_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Rates request failed with ${response.status}`);
      const data = (await response.json()) as RateResponse;
      cachedRates = { base, fetchedAt: now, rates: data.rates };
    }

    const rate = cachedRates.rates[to];
    if (!rate) return { value: null, timestamp: null };
    return {
      value: Math.round(amount * rate * 100) / 100,
      timestamp: new Date(cachedRates.fetchedAt).toISOString(),
    };
  } catch (error) {
    console.warn("FlipLens currency conversion failed", { base, to, reason: error instanceof Error ? error.message : "unknown" });
    return { value: null, timestamp: null };
  }
}

export function formatMoney(value: number | null, currency: SupportedCurrency) {
  if (value === null) return "Currency conversion unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}
