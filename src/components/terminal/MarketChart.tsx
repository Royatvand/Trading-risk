"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { MarketCandle } from "@/features/market-data/types";
import {
  calculateEMA,
  calculateMACD,
  calculateRSI,
  type EmaPeriod,
  type OscillatorType,
} from "@/features/indicators/calculations";
import type { PineResult } from "@/features/pine";

type DrawingTool = "cursor" | "crosshair" | "trend" | "rectangle" | "fibonacci";
type SavedDrawingTool = Exclude<DrawingTool, "cursor" | "crosshair">;
type DrawingPoint = { time: number; price: number };
type SavedDrawing = {
  id: string;
  tool: SavedDrawingTool;
  points: [DrawingPoint, DrawingPoint];
};

type Props = {
  symbol: string;
  timeframe: string;
  candles: MarketCandle[];
  status: "loading" | "connecting" | "live" | "reconnecting" | "error";
  error: string | null;
  activeTool: DrawingTool;
  drawingsVisible: boolean;
  clearDrawingsSignal: number;
  onLoadOlder: () => void;
  isLoadingOlder: boolean;
  hasMoreOlder: boolean;
  olderError: string | null;
  enabledEma: EmaPeriod[];
  activeOscillator: OscillatorType;
  pineResult?: PineResult | null;
};

const fibLevels = [
  { value: 0, label: "0" },
  { value: 0.236, label: "0.236" },
  { value: 0.382, label: "0.382" },
  { value: 0.5, label: "0.5" },
  { value: 0.618, label: "0.618" },
  { value: 0.786, label: "0.786" },
  { value: 1, label: "1" },
];

export default function MarketChart({
  symbol,
  timeframe,
  candles,
  status,
  error,
  activeTool,
  drawingsVisible,
  clearDrawingsSignal,
  onLoadOlder,
  isLoadingOlder,
  hasMoreOlder,
  olderError,
  enabledEma,
  activeOscillator,
  pineResult = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaSeriesRef = useRef<Partial<Record<EmaPeriod, ISeriesApi<"Line">>>>({});
  const oscillatorLineSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const oscillatorHistogramSeriesRef = useRef<ISeriesApi<"Histogram">[]>([]);
  const pineSeriesRef = useRef<ISeriesApi<"Line" | "Histogram">[]>([]);
  const seededRef = useRef(false);
  const firstCandleTimeRef = useRef<number | null>(null);
  const onLoadOlderRef = useRef(onLoadOlder);
  const hasMoreOlderRef = useRef(hasMoreOlder);
  const isLoadingOlderRef = useRef(isLoadingOlder);
  const [, setViewportRevision] = useState(0);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [drawings, setDrawings] = useState<SavedDrawing[]>([]);
  const [storageReadyKey, setStorageReadyKey] = useState<string | null>(null);
  const [draftPoint, setDraftPoint] = useState<DrawingPoint | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);

  const storageKey = "chartmasters:drawings:" + symbol + ":" + timeframe;
  const isDrawingTool = activeTool === "trend" || activeTool === "rectangle" || activeTool === "fibonacci";

  onLoadOlderRef.current = onLoadOlder;
  hasMoreOlderRef.current = hasMoreOlder;
  isLoadingOlderRef.current = isLoadingOlder;

  const toChartTime = useCallback(
    (timestamp: number) => Math.floor(timestamp / 1000) as UTCTimestamp,
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialWidth = Math.max(1, Math.floor(container.getBoundingClientRect().width));
    const initialHeight = Math.max(1, Math.floor(container.getBoundingClientRect().height));
    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#787b86",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e222d" },
        horzLines: { color: "#1e222d" },
      },
      crosshair: {
        vertLine: { color: "#787b86", width: 1, style: 3, labelBackgroundColor: "#2a2e39" },
        horzLine: { color: "#787b86", width: 1, style: 3, labelBackgroundColor: "#2a2e39" },
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#2a2e39",
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
      upColor: "#089981",
      downColor: "#f23645",
      borderUpColor: "#089981",
      borderDownColor: "#f23645",
      wickUpColor: "#089981",
      wickDownColor: "#f23645",
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
      if (!entry) return;

      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      if (width < 2 || height < 2) return;
      chart.applyOptions({ width, height });
      setChartSize({ width, height });
      setViewportRevision((current) => current + 1);
    });
    resizeObserver.observe(container);
    const initialRect = container.getBoundingClientRect();
    if (initialRect.width > 1 && initialRect.height > 1) {
      chart.applyOptions({
        width: Math.floor(initialRect.width),
        height: Math.floor(initialRect.height),
      });
      setChartSize({
        width: Math.floor(initialRect.width),
        height: Math.floor(initialRect.height),
      });
    }

    const handleVisibleRange = () => {
      setViewportRevision((current) => current + 1);
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range && range.from < 45 && !isLoadingOlderRef.current && hasMoreOlderRef.current) {
        void onLoadOlderRef.current();
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRange);
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRange);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRange);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRange);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    seededRef.current = false;
    firstCandleTimeRef.current = null;
    candleSeriesRef.current?.setData([]);
    volumeSeriesRef.current?.setData([]);
  }, [symbol, timeframe]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart || candles.length === 0) return;

    const latest = candles[candles.length - 1];
    const firstTime = candles[0].openTime;

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
        color: candle.close >= candle.open ? "rgba(8, 153, 129, 0.30)" : "rgba(242, 54, 69, 0.30)",
      })));
      chart.timeScale().fitContent();
      firstCandleTimeRef.current = firstTime;
      seededRef.current = true;
      return;
    }

    const previousFirstTime = firstCandleTimeRef.current;

    if (previousFirstTime !== null && firstTime < previousFirstTime) {
      const visibleRange = chart.timeScale().getVisibleLogicalRange();
      const insertedCount = candles.findIndex((candle) => candle.openTime >= previousFirstTime);

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
        color: candle.close >= candle.open ? "rgba(8, 153, 129, 0.30)" : "rgba(242, 54, 69, 0.30)",
      })));
      firstCandleTimeRef.current = firstTime;

      if (visibleRange && insertedCount > 0) {
        chart.timeScale().setVisibleLogicalRange({
          from: visibleRange.from + insertedCount,
          to: visibleRange.to + insertedCount,
        });
      }
      setViewportRevision((current) => current + 1);
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
      color: latest.close >= latest.open ? "rgba(8, 153, 129, 0.30)" : "rgba(242, 54, 69, 0.30)",
    });
  }, [candles, toChartTime]);


  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const periods: EmaPeriod[] = [20, 50, 200];
    const colors: Record<EmaPeriod, string> = {
      20: "#f4c15d",
      50: "#4da3ff",
      200: "#b48bf4",
    };

    for (const period of periods) {
      const existing = emaSeriesRef.current[period];
      const enabled = enabledEma.includes(period);

      if (!enabled) {
        if (existing) {
          chart.removeSeries(existing);
          delete emaSeriesRef.current[period];
        }
        continue;
      }

      const series = existing ?? chart.addSeries(LineSeries, {
        color: colors[period],
        lineWidth: 2,
        title: "EMA " + period,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      emaSeriesRef.current[period] = series;
      series.setData(calculateEMA(candles, period).map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })));
    }
  }, [candles, enabledEma, toChartTime]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    oscillatorLineSeriesRef.current.forEach((series) => chart.removeSeries(series));
    oscillatorHistogramSeriesRef.current.forEach((series) => chart.removeSeries(series));
    oscillatorLineSeriesRef.current = [];
    oscillatorHistogramSeriesRef.current = [];

    if (activeOscillator === "none") return;

    if (activeOscillator === "rsi") {
      const rsi = chart.addSeries(LineSeries, {
        color: "#b48bf4",
        lineWidth: 2,
        title: "RSI 14",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }, 1);
      const overbought = chart.addSeries(LineSeries, {
        color: "rgba(246, 70, 93, 0.55)",
        lineWidth: 1,
        title: "70",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }, 1);
      const oversold = chart.addSeries(LineSeries, {
        color: "rgba(14, 203, 129, 0.55)",
        lineWidth: 1,
        title: "30",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }, 1);

      oscillatorLineSeriesRef.current = [rsi, overbought, oversold];
      chart.panes()[1]?.setHeight(120);
      return;
    }

    const macd = chart.addSeries(LineSeries, {
      color: "#4da3ff",
      lineWidth: 2,
      title: "MACD",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 1);
    const signal = chart.addSeries(LineSeries, {
      color: "#f4c15d",
      lineWidth: 2,
      title: "Signal",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 1);
    const zero = chart.addSeries(LineSeries, {
      color: "rgba(132, 142, 156, 0.45)",
      lineWidth: 1,
      title: "Zero",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 1);
    const histogram = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1);

    oscillatorLineSeriesRef.current = [macd, signal, zero];
    oscillatorHistogramSeriesRef.current = [histogram];
    chart.panes()[1]?.setHeight(140);
  }, [activeOscillator]);

  useEffect(() => {
    if (activeOscillator === "none") return;

    if (activeOscillator === "rsi") {
      const [rsi, overbought, oversold] = oscillatorLineSeriesRef.current;
      if (!rsi || !overbought || !oversold) return;

      const rsiData = calculateRSI(candles);
      rsi.setData(rsiData.map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })));
      const upperData = candles.map((candle) => ({
        time: toChartTime(candle.openTime),
        value: 70,
      }));
      const lowerData = candles.map((candle) => ({
        time: toChartTime(candle.openTime),
        value: 30,
      }));
      overbought.setData(upperData);
      oversold.setData(lowerData);
      return;
    }

    const [macd, signal, zero] = oscillatorLineSeriesRef.current;
    const [histogram] = oscillatorHistogramSeriesRef.current;
    if (!macd || !signal || !zero || !histogram) return;

    const values = calculateMACD(candles);
    macd.setData(values.macd.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
    })));
    signal.setData(values.signal.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
    })));
    zero.setData(values.histogram.map((point) => ({
      time: point.time as UTCTimestamp,
      value: 0,
    })));
    histogram.setData(values.histogram.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
      color: point.value >= 0 ? "rgba(14, 203, 129, 0.52)" : "rgba(246, 70, 93, 0.52)",
    })));
  }, [candles, activeOscillator, toChartTime]);


  // Pine Script output. Recreate series only when the script's plot layout changes.
  const pineLayout = pineResult && pineResult.errors.length === 0
    ? JSON.stringify({
        overlay: pineResult.overlay,
        plots: pineResult.plots.map((plot) => [plot.title, plot.color, plot.lineWidth, plot.style]),
        hlines: pineResult.hlines.map((hline) => [hline.title, hline.color, hline.lineWidth, hline.lineStyle]),
      })
    : null;

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !pineLayout) return;
    const layout = JSON.parse(pineLayout) as {
      overlay: boolean;
      plots: [string, string, number, string][];
      hlines: [string, string, number, string][];
    };
    if (layout.plots.length === 0 && layout.hlines.length === 0) return;

    const paneIndex = layout.overlay ? 0 : activeOscillator === "none" ? 1 : 2;
    const created: ISeriesApi<"Line" | "Histogram">[] = [];
    const baseOptions = {
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    };

    for (const [title, color, lineWidth, style] of layout.plots) {
      if (style === "histogram") {
        created.push(chart.addSeries(HistogramSeries, {
          color,
          title,
          priceLineVisible: false,
          lastValueVisible: false,
        }, paneIndex));
      } else {
        created.push(chart.addSeries(LineSeries, {
          ...baseOptions,
          color,
          lineWidth: lineWidth as 1 | 2 | 3 | 4,
          title,
          ...(style === "circles" ? { lineVisible: false, pointMarkersVisible: true } : {}),
        }, paneIndex));
      }
    }

    for (const [title, color, lineWidth, lineStyle] of layout.hlines) {
      created.push(chart.addSeries(LineSeries, {
        ...baseOptions,
        color,
        lineWidth: lineWidth as 1 | 2 | 3 | 4,
        lineStyle: lineStyle === "solid" ? LineStyle.Solid
          : lineStyle === "dotted" ? LineStyle.Dotted : LineStyle.Dashed,
        title,
      }, paneIndex));
    }

    pineSeriesRef.current = created;
    if (!layout.overlay) chart.panes()[paneIndex]?.setHeight(150);

    return () => {
      pineSeriesRef.current = [];
      const currentChart = chartRef.current;
      if (!currentChart) return;
      for (const series of created) {
        try {
          currentChart.removeSeries(series);
        } catch {
          // The series may already be removed when the chart is recreated.
        }
      }
    };
  }, [pineLayout, activeOscillator]);

  useEffect(() => {
    const created = pineSeriesRef.current;
    if (!pineResult || pineResult.errors.length > 0 || created.length === 0) return;

    pineResult.plots.forEach((plot, index) => {
      const series = created[index];
      if (!series) return;
      series.setData(plot.points.map((point) =>
        point.value === undefined
          ? { time: point.time as UTCTimestamp }
          : {
              time: point.time as UTCTimestamp,
              value: point.value,
              ...(point.color ? { color: point.color } : {}),
            }
      ) as never);
    });

    const times = candles.map((candle) => toChartTime(candle.openTime));
    pineResult.hlines.forEach((hline, index) => {
      const series = created[pineResult.plots.length + index];
      if (!series) return;
      series.setData(times.map((time) => ({ time, value: hline.price })) as never);
    });
  }, [pineResult, pineLayout, activeOscillator, candles, toChartTime]);
  useEffect(() => {
    setDraftPoint(null);
    setPointerPosition(null);
  }, [activeTool]);

  useEffect(() => {
    if (clearDrawingsSignal > 0) {
      setDrawings([]);
      setDraftPoint(null);
      setPointerPosition(null);
    }
  }, [clearDrawingsSignal]);

  useEffect(() => {
    let loaded: SavedDrawing[] = [];

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedDrawing[];
        if (Array.isArray(parsed)) {
          loaded = parsed.filter((drawing) =>
            drawing &&
            typeof drawing.id === "string" &&
            ["trend", "rectangle", "fibonacci"].includes(drawing.tool) &&
            Array.isArray(drawing.points) &&
            drawing.points.length === 2 &&
            drawing.points.every((point) =>
              Number.isFinite(point?.time) && Number.isFinite(point?.price)
            )
          );
        }
      }
    } catch {
      loaded = [];
    }

    setDrawings(loaded);
    setStorageReadyKey(storageKey);
    setDraftPoint(null);
  }, [storageKey]);

  useEffect(() => {
    if (storageReadyKey !== storageKey) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(drawings));
    } catch {
      // Drawings remain usable for this session when browser storage is unavailable.
    }
  }, [drawings, storageKey, storageReadyKey]);

  const pointFromPointer = (event: React.PointerEvent<SVGSVGElement>): DrawingPoint | null => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return null;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);

    if (typeof time !== "number" || price === null || !Number.isFinite(price)) return null;
    return { time, price };
  };

  const handleDrawingPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingTool) return;
    event.preventDefault();
    event.stopPropagation();

    const point = pointFromPointer(event);
    if (!point) return;

    if (!draftPoint) {
      setDraftPoint(point);
      const bounds = event.currentTarget.getBoundingClientRect();
      setPointerPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      return;
    }

    const drawing: SavedDrawing = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      tool: activeTool as SavedDrawingTool,
      points: [draftPoint, point],
    };

    setDrawings((current) => [...current, drawing]);
    setDraftPoint(null);
    setPointerPosition(null);
  };

  const handleDrawingPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingTool || !draftPoint) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointerPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  };

  const coordinateFor = (point: DrawingPoint) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return null;

    const x = chart.timeScale().timeToCoordinate(point.time as UTCTimestamp);
    const y = series.priceToCoordinate(point.price);
    if (x === null || y === null) return null;
    return { x, y };
  };

  const drawingNodes = drawingsVisible ? drawings.map((drawing) => {
    const first = coordinateFor(drawing.points[0]);
    const second = coordinateFor(drawing.points[1]);
    if (!first || !second) return null;

    if (drawing.tool === "trend") {
      return (
        <g key={drawing.id}>
          <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="#f0b84b" strokeWidth="2" />
          <circle cx={first.x} cy={first.y} r="3" fill="#f0b84b" />
          <circle cx={second.x} cy={second.y} r="3" fill="#f0b84b" />
        </g>
      );
    }

    if (drawing.tool === "rectangle") {
      return (
        <g key={drawing.id}>
          <rect
            x={Math.min(first.x, second.x)}
            y={Math.min(first.y, second.y)}
            width={Math.max(1, Math.abs(second.x - first.x))}
            height={Math.max(1, Math.abs(second.y - first.y))}
            fill="rgba(59, 130, 246, 0.10)"
            stroke="#60a5fa"
            strokeWidth="1.5"
          />
          <circle cx={first.x} cy={first.y} r="3" fill="#60a5fa" />
          <circle cx={second.x} cy={second.y} r="3" fill="#60a5fa" />
        </g>
      );
    }

    const left = Math.min(first.x, second.x);
    const right = Math.max(first.x, second.x);
    const priceDelta = drawing.points[1].price - drawing.points[0].price;

    return (
      <g key={drawing.id}>
        {fibLevels.map((level) => {
          const price = drawing.points[0].price + priceDelta * level.value;
          const y = candleSeriesRef.current?.priceToCoordinate(price);
          if (y === null || y === undefined) return null;
          return (
            <g key={level.label}>
              <line x1={left} y1={y} x2={right} y2={y} stroke="#b48bf4" strokeWidth="1" strokeDasharray="5 3" />
              <text x={right + 6} y={y - 4} fill="#c5a7f7" fontSize="10">
                {level.label} · {price.toFixed(price >= 100 ? 2 : 5)}
              </text>
            </g>
          );
        })}
        <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="#b48bf4" strokeWidth="1" opacity="0.65" />
      </g>
    );
  }) : [];

  let draftNode = null;
  if (draftPoint && pointerPosition) {
    const first = coordinateFor(draftPoint);
    if (first) {
      if (activeTool === "rectangle") {
        draftNode = (
          <rect
            x={Math.min(first.x, pointerPosition.x)}
            y={Math.min(first.y, pointerPosition.y)}
            width={Math.max(1, Math.abs(pointerPosition.x - first.x))}
            height={Math.max(1, Math.abs(pointerPosition.y - first.y))}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#60a5fa"
            strokeDasharray="4 3"
          />
        );
      } else {
        draftNode = (
          <line
            x1={first.x}
            y1={first.y}
            x2={pointerPosition.x}
            y2={pointerPosition.y}
            stroke={activeTool === "trend" ? "#f0b84b" : "#b48bf4"}
            strokeWidth="1.5"
            strokeDasharray="5 3"
          />
        );
      }
    }
  }

  return (
    <>
      <div ref={containerRef} className="chart-canvas" aria-label={symbol + " " + timeframe + " Binance candlestick chart"} />
      <svg
        className={"chart-drawing-overlay" + (isDrawingTool ? " drawing-active" : "")}
        width="100%"
        height="100%"
        viewBox={"0 0 " + Math.max(1, chartSize.width) + " " + Math.max(1, chartSize.height)}
        preserveAspectRatio="none"
        onPointerDown={handleDrawingPointerDown}
        onPointerMove={handleDrawingPointerMove}
      >
        {drawingNodes}
        {draftNode}
      </svg>
      {isDrawingTool && (
        <div className="drawing-hint">
          {draftPoint ? "Select the second point" : "Select the first point"}
        </div>
      )}
      {isLoadingOlder && <div className="history-loading">LOADING OLDER CANDLES…</div>}
      {!isLoadingOlder && olderError && (
        <button className="history-error" onClick={() => onLoadOlder()}>
          {olderError} · Retry
        </button>
      )}
      {!hasMoreOlder && candles.length > 0 && <div className="history-end">START OF AVAILABLE HISTORY</div>}
      {candles.length === 0 && (
        <div className="chart-empty-state">
          <strong>{status === "loading" ? "Loading market history" : "Waiting for Binance market data"}</strong>
          <span>{error ?? "Connecting to Binance Spot public market feed..."}</span>
        </div>
      )}
    </>
  );
}
