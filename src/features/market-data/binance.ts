import type { ChartInterval, MarketCandle, Ticker24h } from "./types";

const REST_BASE_URLS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
];
const WS_BASE_URLS = [
  "wss://data-stream.binance.vision:443",
  "wss://stream.binance.com:9443",
  "wss://stream.binance.com:443",
];

const intervalMap: Record<ChartInterval, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "1h", "4h": "4h", "1D": "1d", "1W": "1w",
};

type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string];
type RawTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
};

export type KlineRequestOptions = {
  limit?: number;
  endTime?: number;
};

export function toBinanceInterval(interval: ChartInterval): string {
  return intervalMap[interval];
}

export function createKlineStreamUrl(symbol: string, interval: ChartInterval, hostIndex = 0): string {
  const stream = symbol.toLowerCase() + "@kline_" + toBinanceInterval(interval);
  const baseUrl = WS_BASE_URLS[((hostIndex % WS_BASE_URLS.length) + WS_BASE_URLS.length) % WS_BASE_URLS.length];
  return baseUrl + "/ws/" + stream;
}

export async function fetchKlines(
  symbol: string,
  interval: ChartInterval,
  signal?: AbortSignal,
  options: KlineRequestOptions = {}
): Promise<MarketCandle[]> {
  const limit = Math.min(1000, Math.max(1, options.limit ?? 500));
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval: toBinanceInterval(interval),
    limit: String(limit),
  });

  if (options.endTime !== undefined) {
    params.set("endTime", String(options.endTime));
  }

  let lastError: unknown = null;

  for (const baseUrl of REST_BASE_URLS) {
    try {
      const response = await fetch(baseUrl + "/api/v3/klines?" + params.toString(), {
        method: "GET",
        signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error("Binance history request failed (" + response.status + ")");
      }

      const rows = (await response.json()) as RawKline[];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("No candle history returned by Binance");
      }

      const candles = rows.map((row) => ({
        openTime: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      })).filter((candle) =>
        Number.isFinite(candle.openTime) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.volume)
      );

      if (candles.length > 0) return candles;
      throw new Error("Binance returned no valid candles");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load candle history from Binance endpoints");
}

export async function fetch24hTickers(
  symbols: string[],
  signal?: AbortSignal
): Promise<Record<string, Ticker24h>> {
  const params = new URLSearchParams({
    symbols: JSON.stringify(symbols.map((symbol) => symbol.toUpperCase())),
  });
  const response = await fetch(REST_BASE_URL + "/api/v3/ticker/24hr?" + params.toString(), {
    method: "GET",
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Binance ticker request failed (" + response.status + ")");
  }

  const rows = (await response.json()) as RawTicker[];
  if (!Array.isArray(rows)) {
    throw new Error("Unexpected response from Binance ticker endpoint");
  }

  return Object.fromEntries(rows.map((ticker) => [
    ticker.symbol,
    {
      symbol: ticker.symbol,
      lastPrice: Number(ticker.lastPrice),
      priceChangePercent: Number(ticker.priceChangePercent),
      highPrice: Number(ticker.highPrice),
      lowPrice: Number(ticker.lowPrice),
      quoteVolume: Number(ticker.quoteVolume),
    },
  ]));
}

export function parseKlineEvent(raw: string): MarketCandle | null {
  try {
    const event = JSON.parse(raw) as {
      e?: string;
      k?: { t?: number; o?: string; h?: string; l?: string; c?: string; v?: string };
    };
    if (event.e !== "kline" || !event.k) return null;

    const candle: MarketCandle = {
      openTime: Number(event.k.t),
      open: Number(event.k.o),
      high: Number(event.k.h),
      low: Number(event.k.l),
      close: Number(event.k.c),
      volume: Number(event.k.v),
    };

    return Object.values(candle).every(Number.isFinite) ? candle : null;
  } catch {
    return null;
  }
}
