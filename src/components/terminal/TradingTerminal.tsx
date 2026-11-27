"use client";

import { useState } from "react";
import {
  Activity, ArrowLeftRight, Bell, Bookmark, CandlestickChart, ChevronDown,
  ChevronLeft, CircleHelp, Clock3, Crosshair, Eye, Grid2X2, Maximize2,
  MoreHorizontal, MousePointer2, Plus, Search, Settings2, SlidersHorizontal,
  Square, Star, Trash2, TrendingUp, Undo2, Redo2, Waves, X
} from "lucide-react";
import MarketChart from "./MarketChart";
import { useBinanceMarket } from "@/features/market-data/useBinanceMarket";
import { useBinanceWatchlist } from "@/features/market-data/useBinanceWatchlist";
import type { ChartInterval, Ticker24h } from "@/features/market-data/types";
import type { EmaPeriod, OscillatorType } from "@/features/indicators/calculations";

type DrawingTool = "cursor" | "crosshair" | "trend" | "rectangle" | "fibonacci";

const symbols = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "BNBUSDT", name: "BNB" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "ADAUSDT", name: "Cardano" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
];

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
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [clearDrawingsSignal, setClearDrawingsSignal] = useState(0);
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Trading Panel");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorite, setFavorite] = useState(true);
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const [enabledEma, setEnabledEma] = useState<EmaPeriod[]>([]);
  const [activeOscillator, setActiveOscillator] = useState<OscillatorType>("none");

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
        <button className="toolbar-icon optional" title="Alert"><Bell size={16} /></button>
        <button className="toolbar-action optional"><Clock3 size={15} /> Replay</button>
        <div className="toolbar-spacer" />
        <button className="toolbar-icon" title="Undo"><Undo2 size={17} /></button>
        <button className="toolbar-icon" title="Redo"><Redo2 size={17} /></button>
        <button className="toolbar-icon optional" title="Layout"><Grid2X2 size={17} /></button>
        <button className="toolbar-icon" title="Fullscreen"><Maximize2 size={16} /></button>
      </section>

      <div className="workspace">
        <aside className="drawing-toolbar">
          <ToolButton icon={MousePointer2} label="Cursor" active={activeTool === "cursor"} onClick={() => setActiveTool("cursor")} />
          <ToolButton icon={Crosshair} label="Crosshair" active={activeTool === "crosshair"} onClick={() => setActiveTool("crosshair")} />
          <div className="tool-separator" />
          <ToolButton icon={TrendingUp} label="Trend line" active={activeTool === "trend"} onClick={() => setActiveTool("trend")} />
          <ToolButton icon={Square} label="Rectangle" active={activeTool === "rectangle"} onClick={() => setActiveTool("rectangle")} />
          <ToolButton icon={Waves} label="Fibonacci" active={activeTool === "fibonacci"} onClick={() => setActiveTool("fibonacci")} />
          <div className="tool-separator" />
          <div className="tool-spacer" />
          <ToolButton
            icon={Eye}
            label={drawingsVisible ? "Hide drawings" : "Show drawings"}
            active={!drawingsVisible}
            onClick={() => setDrawingsVisible((visible) => !visible)}
          />
          <ToolButton
            icon={Trash2}
            label="Remove all drawings"
            onClick={() => setClearDrawingsSignal((signal) => signal + 1)}
          />
          <ToolButton icon={Bookmark} label="Drawings auto-saved" active />
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
              enabledEma={enabledEma}
              activeOscillator={activeOscillator}
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
              {enabledEma.length === 0 && activeOscillator === "none" && (
                <span className="muted">No indicators</span>
              )}
            </div>
          </div>

          <div className="bottom-tabs">
            {["Pine Editor", "Strategy Tester", "Trading Panel"].map((tab) => <button key={tab} className={activeTab === tab ? "bottom-tab active" : "bottom-tab"} onClick={() => setActiveTab(tab)}>{tab}</button>}
          </div>
        </section>

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

