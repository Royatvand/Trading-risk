"use client";

import { useEffect, useState } from "react";
import { createKlineStreamUrl, fetchKlines, parseKlineEvent } from "./binance";
import type { ChartInterval, MarketCandle, MarketConnectionStatus } from "./types";

type MarketState = {
  key: string;
  candles: MarketCandle[];
  status: MarketConnectionStatus;
  error: string | null;
};

const emptyState = (key: string): MarketState => ({
  key,
  candles: [],
  status: "loading",
  error: null,
});

export function useBinanceMarket(symbol: string, interval: ChartInterval) {
  const requestKey = symbol + ":" + interval;
  const [state, setState] = useState<MarketState>(() => emptyState(requestKey));
  const visibleState = state.key === requestKey ? state : emptyState(requestKey);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    const controller = new AbortController();

    setState(emptyState(requestKey));

    const updateState = (updater: (current: MarketState) => MarketState) => {
      setState((current) => current.key === requestKey ? updater(current) : current);
    };

    const connect = () => {
      if (disposed) return;

      updateState((current) => ({
        ...current,
        status: current.candles.length > 0 ? "reconnecting" : "connecting",
      }));

      try {
        socket = new WebSocket(createKlineStreamUrl(symbol, interval));

        socket.onopen = () => {
          retryAttempt = 0;
          updateState((current) => ({
            ...current,
            status: "live",
            error: current.candles.length > 0 ? null : current.error,
          }));
        };

        socket.onmessage = (message) => {
          const candle = parseKlineEvent(String(message.data));
          if (!candle) return;

          updateState((current) => {
            const candles = current.candles;
            const last = candles[candles.length - 1];

            if (!last) return { ...current, candles: [candle] };
            if (candle.openTime < last.openTime) return current;

            const nextCandles = candle.openTime === last.openTime
              ? [...candles.slice(0, -1), candle]
              : [...candles, candle].slice(-500);

            return { ...current, candles: nextCandles };
          });
        };

        socket.onerror = () => socket?.close();

        socket.onclose = () => {
          if (disposed) return;
          updateState((current) => ({ ...current, status: "reconnecting" }));
          const delay = Math.min(30_000, 1_000 * (2 ** Math.min(retryAttempt, 5)));
          retryAttempt += 1;
          retryTimer = setTimeout(connect, delay);
        };
      } catch (error) {
        updateState((current) => ({
          ...current,
          status: "reconnecting",
          error: error instanceof Error ? error.message : "Unable to open Binance stream",
        }));
        const delay = Math.min(30_000, 1_000 * (2 ** Math.min(retryAttempt, 5)));
        retryAttempt += 1;
        retryTimer = setTimeout(connect, delay);
      }
    };

    const start = async () => {
      try {
        const history = await fetchKlines(symbol, interval, controller.signal);
        if (disposed) return;

        setState({
          key: requestKey,
          candles: history,
          status: "connecting",
          error: null,
        });
      } catch (error) {
        if (disposed || (error instanceof Error && error.name === "AbortError")) return;
        setState({
          key: requestKey,
          candles: [],
          status: "connecting",
          error: error instanceof Error ? error.message : "Unable to load Binance history",
        });
      }

      connect();
    };

    void start();

    return () => {
      disposed = true;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [interval, requestKey, symbol]);

  return visibleState;
}
