"use client";

import { useEffect, useState } from "react";
import { fetch24hTickers } from "./binance";
import type { Ticker24h } from "./types";

export function useBinanceWatchlist(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, Ticker24h>>({});
  const [error, setError] = useState<string | null>(null);
  const symbolKey = symbols.join(",");

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let controller: AbortController | null = null;
    let requestInFlight = false;

    const refresh = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      controller?.abort();
      controller = new AbortController();

      try {
        const result = await fetch24hTickers(symbols, controller.signal);
        if (!disposed) {
          setTickers(result);
          setError(null);
        }
      } catch (requestError) {
        if (!disposed && !(requestError instanceof Error && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load market tickers");
        }
      } finally {
        requestInFlight = false;
      }
    };

    void refresh();
    timer = setInterval(() => void refresh(), 15_000);

    return () => {
      disposed = true;
      controller?.abort();
      if (timer) clearInterval(timer);
    };
  }, [symbolKey]);

  return { tickers, error };
}
