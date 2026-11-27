"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeftRight, ArrowUpRight, Bell, Bookmark, CandlestickChart, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Code2, Clock3, Crosshair, Circle, Eye, Eraser,
  GitMerge, Grid2X2, Lock, Magnet, Maximize2, Minus, MoveHorizontal, MoveVertical,
  MoreHorizontal, MousePointer2, Plus, Repeat, Ruler, Search, Settings2, Shapes,
  SlidersHorizontal, Square, Star, StickyNote, TrendingDown, TrendingUp, Trash2,
  Type, Undo2, Redo2, Unlock, Waves, X
} from "lucide-react";
import MarketChart from "./MarketChart";
import PineEditorPanel from "./PineEditorPanel";
import { DEFAULT_PINE_SOURCE, runPine } from "@/features/pine";
import { useBinanceMarket } from "@/features/market-data/useBinanceMarket";
import { useBinanceWatchlist } from "@/features/market-data/useBinanceWatchlist";
import type { ChartInterval, Ticker24h } from "@/features/market-data/types";
import type { EmaPeriod, OscillatorType } from "@/features/indicators/calculations";

type DrawingTool =
  | "cursor" | "crosshair" | "eraser"
  | "trend-line" | "ray" | "info-line" | "extended-line"
  | "horizontal-line" | "horizontal-ray" | "vertical-line" | "crossline"
  | "parallel-channel" | "fibonacci" | "fib-extension"
  | "rectangle" | "ellipse" | "shape-arrow"
  | "long-position" | "short-position" | "measure" | "text";

type DrawingToolOption = { id: DrawingTool; label: string; icon: React.ElementType };
type DrawingToolGroup = { id: string; label: string; icon: React.ElementType; tools: DrawingToolOption[] };

const drawingToolGroups: DrawingToolGroup[] = [
  { id: "cursor", label: "Cursors", icon: Crosshair, tools: [
    { id: "crosshair", label: "Cross cursor", icon: Crosshair },
    { id: "cursor", label: "Arrow cursor", icon: MousePointer2 },
    { id: "eraser", label: "Eraser", icon: Eraser },
  ]},
  { id: "trend", label: "Trend line tools", icon: TrendingUp, tools: [
    { id: "trend-line", label: "Trend line", icon: TrendingUp },
    { id: "ray", label: "Ray", icon: ArrowUpRight },
    { id: "info-line", label: "Info line", icon: Ruler },
    { id: "extended-line", label: "Extended line", icon: ArrowLeftRight },
    { id: "horizontal-line", label: "Horizontal line", icon: Minus },
    { id: "horizontal-ray", label: "Horizontal ray", icon: MoveHorizontal },
    { id: "vertical-line", label: "Vertical line", icon: MoveVertical },
    { id: "crossline", label: "Cross line", icon: Crosshair },
  ]},
  { id: "channels", label: "Channels", icon: GitMerge, tools: [
    { id: "parallel-channel", label: "Parallel channel", icon: GitMerge },
  ]},
  { id: "fibonacci", label: "Gann and Fibonacci", icon: Waves, tools: [
    { id: "fibonacci", label: "Fib retracement", icon: Waves },
    { id: "fib-extension", label: "Trend-based Fib extension", icon: Activity },
  ]},
  { id: "shapes", label: "Geometric shapes", icon: Shapes, tools: [
    { id: "rectangle", label: "Rectangle", icon: Square },
    { id: "ellipse", label: "Ellipse", icon: Circle },
    { id: "shape-arrow", label: "Arrow", icon: ArrowUpRight },
  ]},
  { id: "forecast", label: "Forecasting and measurement", icon: Ruler, tools: [
    { id: "long-position", label: "Long position", icon: TrendingUp },
    { id: "short-position", label: "Short position", icon: TrendingDown },
    { id: "measure", label: "Price range", icon: Ruler },
  ]},
  { id: "annotation", label: "Annotation tools", icon: Type, tools: [
    { id: "text", label: "Text note", icon: StickyNote },
  ]},
];

type MagnetMode = "off" | "weak" | "strong";

const symbols = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "BNBUSDT", name: "BNB" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "ADAUSDT", name: "Cardano" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
];

const PINE_STORAGE_KEY = "chartmasters:pine:source";
const PINE_ACTIVE_STORAGE_KEY = "chartmasters:pine:active-source";

const timeframes: ChartInterval[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"];

function formatPrice(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const digits = value >= 100 ? 2 : value >= 1 ? 3 : 6;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCompact(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function changeClass(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "muted";
  return value >= 0 ? "positive" : "negative";
}

function formatChange(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

function ToolButton({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={"tool-button" + (active ? " active" : "")} title={label} aria-label={label} onClick={onClick}>
      <Icon size={17} strokeWidth={1.7} />
    </button>
  );
}

export default function TradingTerminal() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState<ChartInterval>("15m");
  const [activeTool, setActiveTool] = useState<DrawingTool>("crosshair");
  const [openToolGroup, setOpenToolGroup] = useState<string | null>(null);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [keepDrawing, setKeepDrawing] = useState(false);
  const [magnetMode, setMagnetMode] = useState<MagnetMode>("off");
  const [clearDrawingsSignal, setClearDrawingsSignal] = useState(0);
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Trading Panel");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorite, setFavorite] = useState(true);
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const [enabledEma, setEnabledEma] = useState<EmaPeriod[]>([]);
  const [activeOscillator, setActiveOscillator] = useState<OscillatorType>("none");
  const [pineSource, setPineSource] = useState(DEFAULT_PINE_SOURCE);
  const [pineActive, setPineActive] = useState<string | null>(null);
  const [pineLoaded, setPineLoaded] = useState(false);

  // Restore the editor draft and the last-applied script after hydration.
  useEffect(() => {
    try {
      const savedSource = window.localStorage.getItem(PINE_STORAGE_KEY);
      if (savedSource !== null) setPineSource(savedSource);
      const savedActive = window.localStorage.getItem(PINE_ACTIVE_STORAGE_KEY);
      if (savedActive !== null) setPineActive(savedActive);
    } catch {
      // Browser storage may be unavailable; the editor still works for this session.
    }
    setPineLoaded(true);
  }, []);

  useEffect(() => {
    if (!pineLoaded) return;
    try {
      window.localStorage.setItem(PINE_STORAGE_KEY, pineSource);
      if (pineActive === null) window.localStorage.removeItem(PINE_ACTIVE_STORAGE_KEY);
      else window.localStorage.setItem(PINE_ACTIVE_STORAGE_KEY, pineActive);
    } catch {
      // Ignore unavailable or quota-limited storage.
    }
  }, [pineLoaded, pineSource, pineActive]);

  const toggleEma = (period: EmaPeriod, enabled: boolean) => {
    setEnabledEma((current) => enabled
      ? [...current, period].sort((a, b) => a - b)
      : current.filter((item) => item !== period)
    );
  };

  const {
    candles,
    status,
    error,
    hasMoreOlder,
    isLoadingOlder,
    olderError,
    loadOlderCandles,
  } = useBinanceMarket(symbol, timeframe);
  const { tickers, error: tickerError } = useBinanceWatchlist(symbols.map((item) => item.symbol));

  const pineResult = useMemo(
    () => (pineActive === null ? null : runPine(pineActive, candles, { symbol, timeframe })),
    [pineActive, candles, symbol, timeframe]
  );

  const selected = symbols.find((item) => item.symbol === symbol) ?? symbols[0];
  const selectedTicker: Ticker24h | undefined = tickers[symbol];
  const latestCandle = candles[candles.length - 1];
  const lastPrice = selectedTicker?.lastPrice ?? latestCandle?.close;
  const filteredSymbols = symbols.filter((item) =>
    (item.symbol + item.name).toLowerCase().includes(query.toLowerCase())
  );

  const statusLabel = status === "live"
    ? "BINANCE SPOT · LIVE STREAM"
    : status === "reconnecting"
      ? "RECONNECTING TO BINANCE"
      : status === "error"
        ? "BINANCE CONNECTION ERROR"
        : status === "loading"
          ? "LOADING MARKET HISTORY"
          : "CONNECTING TO BINANCE";

  return (
    <main className="terminal-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><CandlestickChart size={20} /></div>
          <span>chart<span className="brand-accent">masters</span></span>
          <span className="brand-divider" />
          <span className="product-label">TERMINAL</span>
        </div>
        <div className="topbar-context">
          <span className="context-dot" />
          <span>SPOT WORKSPACE</span>
          <span className="context-divider">/</span>
          <span className="context-muted">BINANCE</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-action" title="Search"><Search size={17} /></button>
          <button className="icon-action" title="Alerts"><Bell size={17} /></button>
          <button className="icon-action" title="Settings"><Settings2 size={17} /></button>
          <div className="avatar">CM</div>
        </div>
      </header>

      <section className="toolbar">
        <div className="symbol-control">
          <button className="symbol-button" onClick={() => setSearchOpen(!searchOpen)}>
            <span className="coin-icon">₿</span>
            <span>{symbol}</span>
            <ChevronDown size={14} />
          </button>
          {searchOpen && (
            <div className="symbol-popover">
              <div className="search-field">
                <Search size={15} />
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets..." />
                <button onClick={() => { setSearchOpen(false); setQuery(""); }}><X size={14} /></button>
              </div>
              {filteredSymbols.map((item) => {
                const ticker = tickers[item.symbol];
                return (
                  <button key={item.symbol} className="symbol-result" onClick={() => { setSymbol(item.symbol); setSearchOpen(false); setQuery(""); }}>
                    <span><strong>{item.symbol}</strong><small>{item.name}</small></span>
                    <span className={changeClass(ticker?.priceChangePercent)}>{formatPrice(ticker?.lastPrice)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="toolbar-divider" />
        <div className="timeframes">
          {timeframes.map((frame) => <button key={frame} onClick={() => setTimeframe(frame)} className={timeframe === frame ? "timeframe active" : "timeframe"}>{frame}</button>)}
          <button className="toolbar-icon" title="More timeframes"><ChevronDown size={14} /></button>
        </div>
        <div className="toolbar-divider" />
        <button className="toolbar-icon" title="Chart type"><CandlestickChart size={17} /></button>
        <div className="indicator-menu-control">
          <button
            className={"toolbar-action" + (indicatorMenuOpen ? " active" : "")}
            aria-expanded={indicatorMenuOpen}
            onClick={() => setIndicatorMenuOpen((open) => !open)}
          >
            <Plus size={15} /> Indicators
          </button>
          {indicatorMenuOpen && (
            <div className="indicator-popover" role="dialog" aria-label="Chart indicators">
              <div className="indicator-menu-title">Moving averages</div>
              {([20, 50, 200] as const).map((period) => (
                <label className="indicator-choice" key={period}>
                  <input
                    type="checkbox"
                    checked={enabledEma.includes(period)}
                    onChange={(event) => toggleEma(period, event.target.checked)}
                  />
                  <span className={"indicator-color ema-" + period} />
                  <span>EMA {period}</span>
                </label>
              ))}
              <div className="indicator-menu-divider" />
              <div className="indicator-menu-title">Oscillator · one pane</div>
              {([
                ["none", "Off"],
                ["rsi", "RSI · 14"],
                ["macd", "MACD · 12 / 26 / 9"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  className={"indicator-choice indicator-radio" + (activeOscillator === value ? " selected" : "")}
                  role="radio"
                  aria-checked={activeOscillator === value}
                  onClick={() => setActiveOscillator(value)}
                >
                  <span className="indicator-radio-mark" />
                  <span>{label}</span>
                </button>
              ))}
              <div className="indicator-menu-footer">
                Changes apply to the current chart only
              </div>
            </div>
          )}
        </div>
        <button
          className={"toolbar-action" + (activeTab === "Pine Editor" ? " active" : "")}
          onClick={() => setActiveTab((tab) => (tab === "Pine Editor" ? "Trading Panel" : "Pine Editor"))}
          title="Pine Script editor"
        >
          <Code2 size={15} /> Pine
        </button>
        <button className="toolbar-icon optional" title="Alert"><Bell size={16} /></button>
        <button className="toolbar-action optional"><Clock3 size={15} /> Replay</button>
        <div className="toolbar-spacer" />
        <button className="toolbar-icon" title="Undo"><Undo2 size={17} /></button>
        <button className="toolbar-icon" title="Redo"><Redo2 size={17} /></button>
        <button className="toolbar-icon optional" title="Layout"><Grid2X2 size={17} /></button>
        <button className="toolbar-icon" title="Fullscreen"><Maximize2 size={16} /></button>
      </section>

      <div className="workspace">
        <aside className="drawing-toolbar" aria-label="Drawing tools">
          <div className="tool-groups">
            {drawingToolGroups.map((group) => {
              const chosen = group.tools.find((tool) => tool.id === activeTool);
              const Icon = chosen?.icon ?? group.icon;
              return (
                <div className="tool-group" key={group.id}>
                  <button
                    className={"tool-button tool-group-trigger" + (chosen ? " active" : "") + (openToolGroup === group.id ? " menu-open" : "")}
                    title={group.label}
                    aria-label={group.label}
                    aria-haspopup="menu"
                    aria-expanded={openToolGroup === group.id}
                    onClick={() => setOpenToolGroup((current) => current === group.id ? null : group.id)}
                  >
                    <Icon size={18} strokeWidth={1.65} />
                    <ChevronRight className="tool-chevron" size={10} />
                  </button>
                  {openToolGroup === group.id && (
                    <div className="tool-flyout" role="menu" aria-label={group.label}>
                      <div className="tool-flyout-title">{group.label}</div>
                      {group.tools.map((tool) => {
                        const ToolIcon = tool.icon;
                        return (
                          <button key={tool.id}
                            className={"tool-flyout-item" + (activeTool === tool.id ? " selected" : "")}
                            role="menuitem"
                            onClick={() => { setActiveTool(tool.id); setOpenToolGroup(null); }}
                          >
                            <ToolIcon size={16} strokeWidth={1.65} />
                            <span>{tool.label}</span>
                            {activeTool === tool.id && <span className="tool-selected-dot" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="tool-separator" />
          <div className="tool-utility-group">
            <ToolButton icon={Magnet} label={"Magnet: " + (magnetMode === "off" ? "Off" : magnetMode === "weak" ? "Weak" : "Strong")} active={magnetMode !== "off"} onClick={() => setMagnetMode((mode) => mode === "off" ? "weak" : mode === "weak" ? "strong" : "off")} />
            <ToolButton icon={Repeat} label="Keep drawing" active={keepDrawing} onClick={() => setKeepDrawing((value) => !value)} />
            <ToolButton icon={drawingsLocked ? Lock : Unlock} label={drawingsLocked ? "Unlock drawings" : "Lock drawings"} active={drawingsLocked} onClick={() => setDrawingsLocked((value) => !value)} />
            <ToolButton icon={Eye} label={drawingsVisible ? "Hide drawings" : "Show drawings"} active={!drawingsVisible} onClick={() => setDrawingsVisible((visible) => !visible)} />
            <ToolButton icon={Trash2} label="Remove all drawings" onClick={() => setClearDrawingsSignal((signal) => signal + 1)} />
          </div>
        </aside>

        <section className="chart-column">
          <div className="chart-heading">
            <div className="instrument-title">
              <div className="coin-icon large">₿</div>
              <div>
                <div className="instrument-name">{symbol} <span className="market-tag">SPOT</span></div>
                <div className="instrument-subtitle">{selected.name} / TetherUS · Binance</div>
              </div>
              <button className={"star-button" + (favorite ? " starred" : "")} onClick={() => setFavorite(!favorite)} title="Add to favorites"><Star size={16} fill={favorite ? "currentColor" : "none"} /></button>
            </div>
            <div className="quote-summary">
              <div className="quote-price">{formatPrice(lastPrice)}</div>
              <div className={changeClass(selectedTicker?.priceChangePercent)}>
                {formatChange(selectedTicker?.priceChangePercent)} <span>24h</span>
              </div>
            </div>
            <div className="ohlc-summary">
              <span>O <b>{formatPrice(latestCandle?.open)}</b></span>
              <span>H <b>{formatPrice(latestCandle?.high)}</b></span>
              <span>L <b>{formatPrice(latestCandle?.low)}</b></span>
              <span>C <b>{formatPrice(latestCandle?.close)}</b></span>
            </div>
          </div>

          <div className="chart-status-row">
            <div className="chart-legend">
              <span className="legend-symbol">{symbol}</span>
              <span className="legend-timeframe">{timeframe}</span>
              <span className={changeClass(selectedTicker?.priceChangePercent)}>{formatChange(selectedTicker?.priceChangePercent)} (24h)</span>
              <span className="legend-timeframe">{candles.length.toLocaleString("en-US")} candles</span>
            </div>
            <div className="chart-status-actions">
              <button title="Compare"><ArrowLeftRight size={15} /></button>
              <button title="Indicators" onClick={() => setIndicatorMenuOpen((open) => !open)}><Activity size={15} /></button>
              <button title="Settings"><SlidersHorizontal size={15} /></button>
              <button title="More"><MoreHorizontal size={17} /></button>
            </div>
          </div>

          <div className="chart-wrap">
            <div className="chart-watermark"><span>CM</span><strong>CHARTMASTERS</strong><small>MARKET ANALYSIS</small></div>
            <MarketChart
              key={symbol + ":" + timeframe}
              symbol={symbol}
              timeframe={timeframe}
              candles={candles}
              status={status}
              error={error}
              activeTool={activeTool}
              magnetMode={magnetMode}
              keepDrawing={keepDrawing}
              drawingsLocked={drawingsLocked}
              onDrawingComplete={() => setActiveTool("crosshair")}
              enabledEma={enabledEma}
              activeOscillator={activeOscillator}
              pineResult={pineResult}
              drawingsVisible={drawingsVisible}
              clearDrawingsSignal={clearDrawingsSignal}
              onLoadOlder={loadOlderCandles}
              isLoadingOlder={isLoadingOlder}
              hasMoreOlder={hasMoreOlder}
              olderError={olderError}
            />
            <div className="chart-disclaimer">{statusLabel}{error ? " · " + error : ""}</div>
          </div>

          <div className="chart-rangebar">
            <div className="range-presets">
              {["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"].map((range) => (
                <button key={range} className={range === "All" ? "selected" : ""}>{range}</button>
              ))}
              <button className="range-calendar" title="Go to date"><Clock3 size={13} /></button>
            </div>
            <div className="range-controls">
              <span>UTC</span><button>%</button><button>log</button><button className="selected">auto</button>
            </div>
          </div>

          <div className="indicator-strip">
            <div className="indicator-label">STUDIES</div>
            <div className="active-indicators">
              {enabledEma.map((period) => (
                <span className={"indicator-chip ema-chip-" + period} key={period}>EMA {period}</span>
              ))}
              {activeOscillator === "rsi" && <span className="indicator-chip rsi-chip">RSI 14</span>}
              {activeOscillator === "macd" && <span className="indicator-chip macd-chip">MACD 12 / 26 / 9</span>}
              {pineResult && pineResult.errors.length === 0 && (
                <span className="indicator-chip pine-chip">Pine · {pineResult.title}</span>
              )}
              {pineResult && pineResult.errors.length > 0 && (
                <span className="indicator-chip pine-chip error">Pine error</span>
              )}
              {enabledEma.length === 0 && activeOscillator === "none" && !pineResult && (
                <span className="muted">No indicators</span>
              )}
            </div>
          </div>

          {activeTab === "Pine Editor" && (
            <PineEditorPanel
              source={pineSource}
              onSourceChange={setPineSource}
              onRun={() => setPineActive(pineSource)}
              onRemove={() => setPineActive(null)}
              applied={pineActive !== null}
              result={pineResult}
            />
          )}

          <div className="bottom-tabs">
            {["Pine Editor", "Strategy Tester", "Trading Panel"].map((tab) => <button key={tab} className={activeTab === tab ? "bottom-tab active" : "bottom-tab"} onClick={() => setActiveTab(tab)}>{tab}</button>)}
          </div>
        </section>



        {watchlistOpen && (
          <aside className="watchlist-panel">
            <div className="watchlist-header"><strong>Watchlist <ChevronDown size={13} /></strong><div><button title="Add symbol"><Plus size={16} /></button><button title="More"><MoreHorizontal size={17} /></button><button title="Close watchlist" onClick={() => setWatchlistOpen(false)}><X size={15} /></button></div></div>
            <div className="watchlist-tabs"><button className="selected">Watchlist</button><button>Details</button><button>News</button></div>
            <div className="watchlist-group-label"><span>▾</span> CRYPTO <small>· USDT</small></div>
            <div className="watchlist-columns"><span>Symbol</span><span>Last price</span><span>Chg%</span></div>
            <div className="watchlist-items">
              {symbols.map((item) => {
                const ticker = tickers[item.symbol];
                return (
                  <button key={item.symbol} className={symbol === item.symbol ? "watchlist-item selected" : "watchlist-item"} onClick={() => setSymbol(item.symbol)}>
                    <span className="watch-symbol">
                      <i className={"mini-coin " + item.symbol.slice(0, 3).toLowerCase()}>{item.symbol[0]}</i>
                      <span><b>{item.symbol.replace("USDT", "")}</b><small>USDT</small></span>
                    </span>
                    <span className="watch-price">{formatPrice(ticker?.lastPrice)}</span>
                    <span className={changeClass(ticker?.priceChangePercent) + " watch-change"}>{formatChange(ticker?.priceChangePercent)}</span>
                  </button>
                );
              })}
            </div>
            <div className="instrument-card">
              <div className="instrument-card-title"><span>{selected.symbol}</span><button><MoreHorizontal size={16} /></button></div>
              <div className="instrument-card-price">{formatPrice(lastPrice)}</div>
              <div className={changeClass(selectedTicker?.priceChangePercent)}>
                {formatChange(selectedTicker?.priceChangePercent)} <span className="muted">24h</span>
              </div>
              <div className="instrument-stats">
                <div><small>24h High</small><b>{formatPrice(selectedTicker?.highPrice)}</b></div>
                <div><small>24h Low</small><b>{formatPrice(selectedTicker?.lowPrice)}</b></div>
                <div><small>24h Volume</small><b>{formatCompact(selectedTicker?.quoteVolume)} USDT</b></div>
                <div><small>Market</small><b>Spot</b></div>
              </div>
            </div>
            <div className="watchlist-footer"><span className={tickerError ? "connection-dot warning" : "connection-dot"} /> Binance Spot · 24h stats refresh every 15s</div>
          </aside>
        )}
        {!watchlistOpen && <button className="show-watchlist" onClick={() => setWatchlistOpen(true)} title="Show watchlist"><ChevronLeft size={16} /></button>}
        <aside className="right-toolbar" aria-label="Workspace tools">
          <button className="right-tool active" title="Watchlist"><Star size={17} /></button>
          <button className="right-tool" title="Alerts"><Bell size={17} /></button>
          <button className="right-tool" title="Object tree"><Bookmark size={17} /></button>
          <button className="right-tool" title="Screeners"><Grid2X2 size={17} /></button>
          <button className="right-tool" title="Calendar"><Clock3 size={17} /></button>
          <div className="right-tool-separator" />
          <button className="right-tool" title="Indicators"><Activity size={17} /></button>
          <button className="right-tool" title="Help"><CircleHelp size={17} /></button>
          <div className="right-tool-spacer" />
          <button className="right-tool" title="Settings"><Settings2 size={17} /></button>
        </aside>
      </div>

      <footer className="statusbar">
        <div className="status-left">
          <span><span className={status === "live" ? "connection-dot live" : "connection-dot"} /> {statusLabel}</span>
          <span>ChartMasters Terminal</span>
        </div>
        <div className="status-right"><button><CircleHelp size={14} /> Help</button><span>© ChartMasters</span></div>
      </footer>
    </main>
  );
}

