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

type DrawingTool =
  | "cursor" | "crosshair" | "eraser"
  | "trend-line" | "ray" | "info-line" | "extended-line"
  | "horizontal-line" | "horizontal-ray" | "vertical-line" | "crossline"
  | "parallel-channel" | "fibonacci" | "fib-extension"
  | "rectangle" | "ellipse" | "shape-arrow"
  | "long-position" | "short-position" | "measure" | "text";
type SavedDrawingTool = Exclude<DrawingTool, "cursor" | "crosshair" | "eraser">;
type DrawingPoint = { time: number; price: number };
type SavedDrawing = { id: string; tool: SavedDrawingTool; points: DrawingPoint[]; text?: string };
type MagnetMode = "off" | "weak" | "strong";
const savedDrawingTools: SavedDrawingTool[] = [
  "trend-line", "ray", "info-line", "extended-line", "horizontal-line", "horizontal-ray",
  "vertical-line", "crossline", "parallel-channel", "fibonacci", "fib-extension",
  "rectangle", "ellipse", "shape-arrow", "long-position", "short-position", "measure", "text",
];
function requiredPoints(tool: DrawingTool): number {
  if (["text", "horizontal-line", "horizontal-ray", "vertical-line", "crossline"].includes(tool)) return 1;
  if (tool === "parallel-channel" || tool === "fib-extension") return 3;
  return 2;
}
function pointToSegmentDistance(point: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}): number {
  const dx=b.x-a.x, dy=b.y-a.y, lengthSquared=dx*dx+dy*dy;
  if (lengthSquared===0) return Math.hypot(point.x-a.x,point.y-a.y);
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSquared));
  return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
}

type Props = {
  symbol: string;
  timeframe: string;
  candles: MarketCandle[];
  status: "loading" | "connecting" | "live" | "reconnecting" | "error";
  error: string | null;
  activeTool: DrawingTool;
  magnetMode: MagnetMode;
  keepDrawing: boolean;
  drawingsLocked: boolean;
  onDrawingComplete: () => void;
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
  magnetMode,
  keepDrawing,
  drawingsLocked,
  onDrawingComplete,
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
  const [draftPoints, setDraftPoints] = useState<DrawingPoint[]>([]);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);

  const storageKey = "chartmasters:drawings:" + symbol + ":" + timeframe;
  const isDrawingTool = activeTool !== "cursor" && activeTool !== "crosshair";

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

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
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
      chart.applyOptions({ width, height });
      setChartSize({ width, height });
      setViewportRevision((current) => current + 1);
    });
    resizeObserver.observe(container);
    setChartSize({ width: container.clientWidth, height: container.clientHeight });

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
    setDraftPoints([]);
    setPointerPosition(null);
  }, [activeTool]);

  useEffect(() => {
    if (clearDrawingsSignal > 0) {
      setDrawings([]);
      setDraftPoints([]);
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
            savedDrawingTools.includes(drawing.tool) &&
            Array.isArray(drawing.points) &&
            drawing.points.length >= requiredPoints(drawing.tool) &&
            drawing.points.length <= 3 &&
            drawing.points.every((point) =>
              Number.isFinite(point?.time) && Number.isFinite(point?.price)
            ) &&
            (drawing.tool !== "text" || typeof drawing.text === "string")
          );
        }
      }
    } catch {
      loaded = [];
    }

    setDrawings(loaded);
    setStorageReadyKey(storageKey);
    setDraftPoints([]);
  }, [storageKey]);

  useEffect(() => {
    if (storageReadyKey !== storageKey) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(drawings));
    } catch {
      // Drawings remain usable for this session when browser storage is unavailable.
    }
  }, [drawings, storageKey, storageReadyKey]);

  const coordinateFor = (point: DrawingPoint) => {
    const chart=chartRef.current, series=candleSeriesRef.current;
    if(!chart||!series)return null;
    const x=chart.timeScale().timeToCoordinate(point.time as UTCTimestamp), y=series.priceToCoordinate(point.price);
    if(x===null||y===null)return null;
    return {x,y};
  };

  const pointFromPointer = (event: React.PointerEvent<SVGSVGElement>): DrawingPoint | null => {
    const chart=chartRef.current, series=candleSeriesRef.current;
    if(!chart||!series)return null;
    const bounds=event.currentTarget.getBoundingClientRect(), x=event.clientX-bounds.left, y=event.clientY-bounds.top;
    const time=chart.timeScale().coordinateToTime(x), rawPrice=series.coordinateToPrice(y);
    if(typeof time!=="number"||rawPrice===null||!Number.isFinite(rawPrice))return null;
    if(magnetMode==="off")return {time,price:rawPrice};
    const logical=chart.timeScale().coordinateToLogical(x), candle=logical===null?undefined:candles[Math.round(logical)];
    if(!candle)return {time,price:rawPrice};
    if(magnetMode==="weak")return {time:toChartTime(candle.openTime),price:candle.close};
    const candidates=[candle.open,candle.high,candle.low,candle.close];
    const snapped=candidates.reduce((best,candidate)=>{
      const cy=series.priceToCoordinate(candidate), by=series.priceToCoordinate(best);
      if(cy===null)return best;if(by===null)return candidate;
      return Math.abs(cy-y)<Math.abs(by-y)?candidate:best;
    },candidates[0]);
    return {time:toChartTime(candle.openTime),price:snapped};
  };

  const finishDrawing = (tool: SavedDrawingTool, points: DrawingPoint[], text?: string) => {
    setDrawings(current=>[...current,{id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),tool,points,...(text?{text}:{})}]);
    setDraftPoints([]);setPointerPosition(null);
    if(!keepDrawing)onDrawingComplete();
  };

  const handleErase = (event: React.PointerEvent<SVGSVGElement>) => {
    if(drawingsLocked)return;
    const bounds=event.currentTarget.getBoundingClientRect(), cursor={x:event.clientX-bounds.left,y:event.clientY-bounds.top};
    let nearestId:string|null=null, nearestDistance=18;
    for(const drawing of drawings){
      const points=drawing.points.map(coordinateFor).filter((p):p is {x:number;y:number}=>Boolean(p));
      if(!points.length)continue;
      let distance=Math.min(...points.map(p=>Math.hypot(cursor.x-p.x,cursor.y-p.y)));
      if(points.length>=2)distance=Math.min(distance,pointToSegmentDistance(cursor,points[0],points[1]));
      if(distance<nearestDistance){nearestDistance=distance;nearestId=drawing.id;}
    }
    if(nearestId)setDrawings(current=>current.filter(drawing=>drawing.id!==nearestId));
  };

  const handleDrawingPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if(!isDrawingTool)return;
    event.preventDefault();event.stopPropagation();
    if(activeTool==="eraser"){handleErase(event);return;}
    const point=pointFromPointer(event);if(!point)return;
    if(activeTool==="text"){
      const value=window.prompt("متن یادداشت روی نمودار","یادداشت");
      if(value===null||!value.trim())return;
      finishDrawing("text",[point],value.trim());return;
    }
    const needed=requiredPoints(activeTool), next=[...draftPoints,point];
    if(next.length>=needed){finishDrawing(activeTool as SavedDrawingTool,next.slice(0,needed));return;}
    setDraftPoints(next);
    const bounds=event.currentTarget.getBoundingClientRect();
    setPointerPosition({x:event.clientX-bounds.left,y:event.clientY-bounds.top});
  };

  const handleDrawingPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if(!isDrawingTool||activeTool==="eraser"||draftPoints.length===0)return;
    const bounds=event.currentTarget.getBoundingClientRect();
    setPointerPosition({x:event.clientX-bounds.left,y:event.clientY-bounds.top});
  };

  const drawingNodes = drawingsVisible ? drawings.map(drawing=>{
    const coordinates=drawing.points.map(coordinateFor);
    if(coordinates.some(point=>!point))return null;
    const points=coordinates as Array<{x:number;y:number}>, first=points[0], second=points[1]??first, third=points[2]??first, blue="#2962ff";
    const handles=<>{points.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r="3" fill={blue}/>)}</>;
    if(drawing.tool==="horizontal-line"||drawing.tool==="horizontal-ray")return <g key={drawing.id}><line x1={drawing.tool==="horizontal-line"?0:first.x} y1={first.y} x2={chartSize.width} y2={first.y} stroke={blue} strokeWidth="1.5"/>{handles}</g>;
    if(drawing.tool==="vertical-line")return <g key={drawing.id}><line x1={first.x} y1="0" x2={first.x} y2={chartSize.height} stroke={blue} strokeWidth="1.5"/>{handles}</g>;
    if(drawing.tool==="crossline")return <g key={drawing.id}><line x1="0" y1={first.y} x2={chartSize.width} y2={first.y} stroke={blue} strokeDasharray="4 4"/><line x1={first.x} y1="0" x2={first.x} y2={chartSize.height} stroke={blue} strokeDasharray="4 4"/>{handles}</g>;
    if(drawing.tool==="text")return <g key={drawing.id}>{handles}<text x={first.x+8} y={first.y-8} fill="#d1d4dc" fontSize="12" fontWeight="600" paintOrder="stroke" stroke="#131722" strokeWidth="3">{drawing.text}</text></g>;
    if(drawing.tool==="rectangle")return <g key={drawing.id}><rect x={Math.min(first.x,second.x)} y={Math.min(first.y,second.y)} width={Math.max(1,Math.abs(second.x-first.x))} height={Math.max(1,Math.abs(second.y-first.y))} fill="rgba(41,98,255,.10)" stroke={blue} strokeWidth="1.5"/>{handles}</g>;
    if(drawing.tool==="ellipse")return <g key={drawing.id}><ellipse cx={(first.x+second.x)/2} cy={(first.y+second.y)/2} rx={Math.max(1,Math.abs(second.x-first.x)/2)} ry={Math.max(1,Math.abs(second.y-first.y)/2)} fill="rgba(41,98,255,.08)" stroke={blue} strokeWidth="1.5"/>{handles}</g>;
    if(drawing.tool==="parallel-channel"){
      const dx=second.x-first.x,dy=second.y-first.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
      const offset=(third.x-first.x)*nx+(third.y-first.y)*ny,ox=nx*offset,oy=ny*offset;
      return <g key={drawing.id}><polygon points={`${first.x},${first.y} ${second.x},${second.y} ${second.x+ox},${second.y+oy} ${first.x+ox},${first.y+oy}`} fill="rgba(41,98,255,.08)"/><line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke={blue} strokeWidth="1.5"/><line x1={first.x+ox} y1={first.y+oy} x2={second.x+ox} y2={second.y+oy} stroke={blue} strokeWidth="1.5"/><line x1={first.x} y1={first.y} x2={first.x+ox} y2={first.y+oy} stroke={blue} strokeDasharray="3 3"/><line x1={second.x} y1={second.y} x2={second.x+ox} y2={second.y+oy} stroke={blue} strokeDasharray="3 3"/>{handles}</g>;
    }
    if(drawing.tool==="fibonacci"||drawing.tool==="fib-extension"){
      const left=drawing.tool==="fibonacci"?Math.min(first.x,second.x):third.x,right=drawing.tool==="fibonacci"?Math.max(first.x,second.x):chartSize.width;
      const levels=drawing.tool==="fibonacci"?[0,.236,.382,.5,.618,.786,1]:[0,.618,1,1.272,1.618,2.618];
      const startPrice=drawing.tool==="fibonacci"?drawing.points[0].price:drawing.points[2].price, move=drawing.points[1].price-drawing.points[0].price;
      return <g key={drawing.id}>{levels.map(level=>{const price=startPrice+move*level,y=candleSeriesRef.current?.priceToCoordinate(price);if(y==null)return null;return <g key={level}><line x1={left} y1={y} x2={right} y2={y} stroke={blue} strokeDasharray="5 3"/><text x={right+5} y={y-4} fill="#9dbbff" fontSize="10">{level.toFixed(3)} · {price.toFixed(price>=100?2:5)}</text></g>;})}{handles}</g>;
    }
    if(drawing.tool==="long-position"||drawing.tool==="short-position"){
      const entry=drawing.points[0].price,stop=drawing.points[1].price,risk=Math.max(Math.abs(entry-stop),Math.abs(entry)*.0001);
      const target=entry+(drawing.tool==="long-position"?1:-1)*risk*1.5;
      const entryY=candleSeriesRef.current?.priceToCoordinate(entry),stopY=candleSeriesRef.current?.priceToCoordinate(stop),targetY=candleSeriesRef.current?.priceToCoordinate(target);
      if(entryY==null||stopY==null||targetY==null)return null;
      const left=Math.min(first.x,second.x),right=Math.min(chartSize.width,left+130);
      return <g key={drawing.id}><rect x={left} y={Math.min(entryY,targetY)} width={Math.max(8,right-left)} height={Math.max(1,Math.abs(entryY-targetY))} fill="rgba(8,153,129,.18)" stroke="#089981"/><rect x={left} y={Math.min(entryY,stopY)} width={Math.max(8,right-left)} height={Math.max(1,Math.abs(entryY-stopY))} fill="rgba(242,54,69,.16)" stroke="#f23645"/><line x1={left} y1={entryY} x2={right} y2={entryY} stroke="#d1d4dc" strokeDasharray="3 3"/><text x={right-5} y={entryY-5} textAnchor="end" fill="#d1d4dc" fontSize="10">{drawing.tool==="long-position"?"LONG":"SHORT"} · R:R 1.5</text>{handles}</g>;
    }
    const delta=drawing.points[1].price-drawing.points[0].price,pct=drawing.points[0].price===0?0:delta/drawing.points[0].price*100;
    if(drawing.tool==="ray"||drawing.tool==="extended-line"){
      const dx=second.x-first.x,dy=second.y-first.y,slope=dx===0?0:dy/dx,x1=drawing.tool==="extended-line"?0:first.x,x2=chartSize.width;
      return <g key={drawing.id}><line x1={x1} y1={first.y+slope*(x1-first.x)} x2={x2} y2={first.y+slope*(x2-first.x)} stroke={blue} strokeWidth="1.5"/>{handles}</g>;
    }
    if(drawing.tool==="shape-arrow")return <g key={drawing.id}><line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke={blue} strokeWidth="1.8" markerEnd="url(#chart-drawing-arrow)"/>{handles}</g>;
    return <g key={drawing.id}><line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke={blue} strokeWidth="1.5"/>{(drawing.tool==="info-line"||drawing.tool==="measure")&&<g><rect x={(first.x+second.x)/2-62} y={(first.y+second.y)/2-24} width="124" height="20" rx="3" fill="#1e222d" stroke="#363a45"/><text x={(first.x+second.x)/2} y={(first.y+second.y)/2-10} textAnchor="middle" fill="#d1d4dc" fontSize="10">{delta>=0?"+":""}{delta.toFixed(2)} ({pct>=0?"+":""}{pct.toFixed(2)}%)</text></g>}{handles}</g>;
  }) : [];

  let draftNode=null;
  if(draftPoints.length>0&&pointerPosition){
    const last=coordinateFor(draftPoints[draftPoints.length-1]);
    if(last){
      if(activeTool==="rectangle")draftNode=<rect x={Math.min(last.x,pointerPosition.x)} y={Math.min(last.y,pointerPosition.y)} width={Math.max(1,Math.abs(pointerPosition.x-last.x))} height={Math.max(1,Math.abs(pointerPosition.y-last.y))} fill="rgba(41,98,255,.08)" stroke="#2962ff" strokeDasharray="4 3"/>;
      else if(activeTool==="ellipse")draftNode=<ellipse cx={(last.x+pointerPosition.x)/2} cy={(last.y+pointerPosition.y)/2} rx={Math.max(1,Math.abs(pointerPosition.x-last.x)/2)} ry={Math.max(1,Math.abs(pointerPosition.y-last.y)/2)} fill="rgba(41,98,255,.08)" stroke="#2962ff" strokeDasharray="4 3"/>;
      else draftNode=<line x1={last.x} y1={last.y} x2={pointerPosition.x} y2={pointerPosition.y} stroke="#2962ff" strokeWidth="1.5" strokeDasharray="5 3"/>;
    }
  }
  const drawingHint=activeTool==="eraser"?(drawingsLocked?"Unlock drawings to erase":"Click a drawing to erase"):draftPoints.length>0?`Select point ${draftPoints.length+1} of ${requiredPoints(activeTool)}`:activeTool==="text"?"Click to place a text note":"Click on the chart to start drawing";

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
        <defs><marker id="chart-drawing-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#2962ff"/></marker></defs>
        {drawingNodes}
        {draftNode}
      </svg>
      {isDrawingTool && <div className="drawing-hint">{drawingHint}</div>}
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
