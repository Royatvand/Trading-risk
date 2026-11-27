"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { MarketCandle } from "@/features/market-data/types";

type Props = {
  symbol: string;
  timeframe: string;
  candles: MarketCandle[];
  status: "loading" | "connecting" | "live" | "reconnecting" | "error";
  error: string | null;
};

export default function MarketChart({ symbol, timeframe, candles, status, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e11" },
        textColor: "#848e9c",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1b2028" },
        horzLines: { color: "#1b2028" },
      },
      crosshair: {
        vertLine: { color: "#758696", width: 1, style: 3, labelBackgroundColor: "#303843" },
        horzLine: { color: "#758696", width: 1, style: 3, labelBackgroundColor: "#303843" },
      },
      rightPriceScale: {
        borderColor: "#252b34",
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#252b34",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
      },
      localization: { locale: "en-US" },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d",
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.83, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        chart.applyOptions({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    seededRef.current = false;
    candleSeriesRef.current?.setData([]);
    volumeSeriesRef.current?.setData([]);
  }, [symbol, timeframe]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || candles.length === 0) return;

    const toChartTime = (timestamp: number) => Math.floor(timestamp / 1000) as UTCTimestamp;
    const latest = candles[candles.length - 1];

    if (!seededRef.current) {
      candleSeries.setData(candles.map((candle) => ({
        time: toChartTime(candle.openTime),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })));
      volumeSeries.setData(candles.map((candle) => ({
        time: toChartTime(candle.openTime),
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(14, 203, 129, 0.34)" : "rgba(246, 70, 93, 0.34)",
      })));
      chartRef.current?.timeScale().fitContent();
      seededRef.current = true;
      return;
    }

    candleSeries.update({
      time: toChartTime(latest.openTime),
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
    });
    volumeSeries.update({
      time: toChartTime(latest.openTime),
      value: latest.volume,
      color: latest.close >= latest.open ? "rgba(14, 203, 129, 0.34)" : "rgba(246, 70, 93, 0.34)",
    });
  }, [candles]);

  return (
    <>
      <div ref={containerRef} className="chart-canvas" aria-label={symbol + " " + timeframe + " Binance candlestick chart"} />
      {candles.length === 0 && (
        <div className="chart-empty-state">
          <strong>{status === "loading" ? "Loading market history" : "Waiting for Binance market data"}</strong>
          <span>{error ?? "Connecting to Binance Spot public market feed..."}</span>
        </div>
      )}
    </>
  );
}
