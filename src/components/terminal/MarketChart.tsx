"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";

type Props = {
  symbol: string;
  timeframe: string;
};

function seedFromText(value: string) {
  return value.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function makeCandles(symbol: string, timeframe: string) {
  const now = Math.floor(Date.now() / 1000);
  const intervalMap: Record<string, number> = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "4h": 14400, "1D": 86400, "1W": 604800,
  };
  const interval = intervalMap[timeframe] ?? 900;
  const seed = seedFromText(symbol + timeframe);
  let previous = symbol.startsWith("ETH") ? 3200 : symbol.startsWith("SOL") ? 145 : 67400;
  const candles = [];
  const volumes = [];

  for (let index = 180; index >= 0; index -= 1) {
    const wave = Math.sin((index + seed) / 8) * previous * 0.0018;
    const drift = Math.cos((index + seed) / 17) * previous * 0.0008;
    const open = previous;
    const close = Math.max(0.01, open + wave + drift);
    const high = Math.max(open, close) + Math.abs(Math.sin(index + seed)) * previous * 0.0012;
    const low = Math.min(open, close) - Math.abs(Math.cos(index + seed)) * previous * 0.0012;
    const time = (Math.floor(now / interval) * interval - index * interval) as UTCTimestamp;
    candles.push({ time, open, high, low, close });
    volumes.push({
      time,
      value: 12 + Math.abs(Math.sin(index * 2.1 + seed)) * 85,
      color: close >= open ? "rgba(38, 166, 154, 0.38)" : "rgba(239, 83, 80, 0.38)",
    });
    previous = close;
  }

  return { candles, volumes };
}

export default function MarketChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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
        scaleMargins: { top: 0.1, bottom: 0.2 },
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

    const { candles, volumes } = makeCandles(symbol, timeframe);
    candleSeries.setData(candles);
    volumeSeries.setData(volumes);
    chart.timeScale().fitContent();
    chartRef.current = chart;

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
    };
  }, [symbol, timeframe]);

  return <div ref={containerRef} className="chart-canvas" aria-label={symbol + " candlestick chart"} />;
}
