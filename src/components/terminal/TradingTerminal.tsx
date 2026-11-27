"use client";

import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUpRight, Bell, Bookmark,
  CandlestickChart, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Crosshair, Download, Eye, FileText, Flag, Grid2X2, Layers3, LineChart,
  Maximize2, Menu, Minus, MoreHorizontal, MousePointer2, Pencil, Plus, Search,
  Settings2, Shapes, SlidersHorizontal, Square, Star, Trash2, TrendingUp, Type,
  Undo2, Redo2, Waves, X, ZoomIn, ZoomOut
} from "lucide-react";
import MarketChart from "./MarketChart";

const symbols = [
  { symbol: "BTCUSDT", name: "Bitcoin", price: "67,482.10", change: "+2.41%", positive: true },
  { symbol: "ETHUSDT", name: "Ethereum", price: "3,521.84", change: "+1.82%", positive: true },
  { symbol: "BNBUSDT", name: "BNB", price: "612.30", change: "-0.64%", positive: false },
  { symbol: "SOLUSDT", name: "Solana", price: "148.62", change: "+4.18%", positive: true },
  { symbol: "XRPUSDT", name: "XRP", price: "0.6241", change: "-1.12%", positive: false },
  { symbol: "ADAUSDT", name: "Cardano", price: "0.4826", change: "+0.73%", positive: true },
  { symbol: "DOGEUSDT", name: "Dogecoin", price: "0.1642", change: "+3.05%", positive: true },
];

const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"];

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
  const [timeframe, setTimeframe] = useState("15m");
  const [activeTool, setActiveTool] = useState("crosshair");
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Trading Panel");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorite, setFavorite] = useState(true);

  const selected = useMemo(() => symbols.find((item) => item.symbol === symbol) ?? symbols[0], [symbol]);
  const filteredSymbols = symbols.filter((item) =>
    (item.symbol + item.name).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="terminal-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><CandlestickChart size={20} /></div>
          <span>chart<span className="brand-accent">masters</span></span>
          <span className="brand-divider" />
          <span className="product-label">TERMINAL</span>
        </div>
        <nav className="main-menu">
          {["File", "View", "Insert", "Charts", "Trading", "Help"].map((item) => (
            <button key={item} className="menu-item">{item}</button>
          ))}
        </nav>
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
              <div className="search-field"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets..." /><button onClick={() => { setSearchOpen(false); setQuery(""); }}><X size={14} /></button></div>
              {filteredSymbols.map((item) => (
                <button key={item.symbol} className="symbol-result" onClick={() => { setSymbol(item.symbol); setSearchOpen(false); setQuery(""); }}>
                  <span><strong>{item.symbol}</strong><small>{item.name}</small></span>
                  <span className={item.positive ? "positive" : "negative"}>{item.price}</span>
                </button>
              ))}
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
        <button className="toolbar-action"><Plus size={15} /> Indicators</button>
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
          <ToolButton icon={MousePointer2} label="Cursor" active={activeTool === "crosshair"} onClick={() => setActiveTool("crosshair")} />
          <ToolButton icon={Crosshair} label="Crosshair" active={activeTool === "crosshair"} onClick={() => setActiveTool("crosshair")} />
          <div className="tool-separator" />
          <ToolButton icon={TrendingUp} label="Trend line" active={activeTool === "trend"} onClick={() => setActiveTool("trend")} />
          <ToolButton icon={Shapes} label="Shapes" active={activeTool === "shapes"} onClick={() => setActiveTool("shapes")} />
          <ToolButton icon={Square} label="Rectangle" active={activeTool === "rectangle"} onClick={() => setActiveTool("rectangle")} />
          <ToolButton icon={Waves} label="Fibonacci" active={activeTool === "fibonacci"} onClick={() => setActiveTool("fibonacci")} />
          <ToolButton icon={Type} label="Text" active={activeTool === "text"} onClick={() => setActiveTool("text")} />
          <div className="tool-separator" />
          <ToolButton icon={RulerIcon} label="Measure" active={activeTool === "measure"} onClick={() => setActiveTool("measure")} />
          <ToolButton icon={ZoomIn} label="Zoom in" />
          <ToolButton icon={ZoomOut} label="Zoom out" />
          <div className="tool-spacer" />
          <ToolButton icon={Eye} label="Hide drawings" />
          <ToolButton icon={Trash2} label="Remove drawings" />
          <ToolButton icon={Bookmark} label="Save drawing template" />
        </aside>

        <section className="chart-column">
          <div className="chart-heading">
            <div className="instrument-title">
              <div className="coin-icon large">₿</div>
              <div><div className="instrument-name">{symbol} <span className="market-tag">SPOT</span></div><div className="instrument-subtitle">Bitcoin / TetherUS · Binance</div></div>
              <button className={"star-button" + (favorite ? " starred" : "")} onClick={() => setFavorite(!favorite)} title="Add to favorites"><Star size={16} fill={favorite ? "currentColor" : "none"} /></button>
            </div>
            <div className="quote-summary">
              <div className="quote-price">{selected.price}</div>
              <div className={selected.positive ? "positive" : "negative"}>{selected.change} <span>today</span></div>
            </div>
            <div className="ohlc-summary"><span>O <b>67,210.40</b></span><span>H <b>67,690.00</b></span><span>L <b>66,980.20</b></span><span>C <b>67,482.10</b></span></div>
          </div>

          <div className="chart-status-row">
            <div className="chart-legend"><span className="legend-symbol">{symbol}</span><span className="legend-timeframe">{timeframe}</span><span className="positive">+272.10 (+0.41%)</span></div>
            <div className="chart-status-actions"><button title="Compare"><ArrowLeftRight size={15} /></button><button title="Indicators"><Activity size={15} /></button><button title="Settings"><SlidersHorizontal size={15} /></button><button title="More"><MoreHorizontal size={17} /></button></div>
          </div>

          <div className="chart-wrap">
            <div className="chart-watermark"><span>CM</span><strong>CHARTMASTERS</strong><small>MARKET ANALYSIS</small></div>
            <MarketChart symbol={symbol} timeframe={timeframe} />
            <div className="chart-disclaimer">DEMO DATA · BINANCE CONNECTION PENDING</div>
          </div>

          <div className="indicator-strip">
            <div className="indicator-label">RSI (14) <span>52.48</span></div>
            <div className="indicator-placeholder"><span>RSI</span><div className="rsi-line" /></div>
            <div className="indicator-label">MACD (12, 26, 9) <span>12.40</span></div>
          </div>

          <div className="bottom-tabs">
            {["Trading Panel", "Strategy Tester", "Replay"].map((tab) => <button key={tab} className={activeTab === tab ? "bottom-tab active" : "bottom-tab"} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            <div className="bottom-tab-spacer" />
            <button className="bottom-icon" title="Collapse panel"><ChevronDown size={15} /></button>
          </div>
        </section>

        {watchlistOpen && (
          <aside className="watchlist-panel">
            <div className="watchlist-header"><strong>Watchlist</strong><div><button title="Add symbol"><Plus size={16} /></button><button title="More"><MoreHorizontal size={17} /></button><button title="Close watchlist" onClick={() => setWatchlistOpen(false)}><X size={15} /></button></div></div>
            <div className="watchlist-columns"><span>Symbol</span><span>Last price</span><span>Chg%</span></div>
            <div className="watchlist-items">
              {symbols.map((item) => (
                <button key={item.symbol} className={symbol === item.symbol ? "watchlist-item selected" : "watchlist-item"} onClick={() => setSymbol(item.symbol)}>
                  <span className="watch-symbol"><i className={"mini-coin " + item.symbol.slice(0, 3).toLowerCase()}>{item.symbol[0]}</i><span><b>{item.symbol.replace("USDT", "")}</b><small>USDT</small></span></span>
                  <span className="watch-price">{item.price}</span>
                  <span className={item.positive ? "positive watch-change" : "negative watch-change"}>{item.change}</span>
                </button>
              ))}
            </div>
            <div className="instrument-card">
              <div className="instrument-card-title"><span>{selected.symbol}</span><button><MoreHorizontal size={16} /></button></div>
              <div className="instrument-card-price">{selected.price}</div>
              <div className={selected.positive ? "positive" : "negative"}>{selected.change} <span className="muted">24h</span></div>
              <div className="instrument-stats"><div><small>24h High</small><b>68,120.00</b></div><div><small>24h Low</small><b>66,240.00</b></div><div><small>24h Volume</small><b>1.24B USDT</b></div><div><small>Market</small><b>Spot</b></div></div>
            </div>
            <div className="watchlist-footer"><span className="connection-dot" /> Demo workspace</div>
          </aside>
        )}
        {!watchlistOpen && <button className="show-watchlist" onClick={() => setWatchlistOpen(true)} title="Show watchlist"><ChevronLeft size={16} /></button>}
      </div>

      <footer className="statusbar">
        <div className="status-left"><span><span className="connection-dot" /> SIMULATED MARKET</span><span>UTC 14:32:08</span><span>ChartMasters Terminal</span></div>
        <div className="status-right"><button><CircleHelp size={14} /> Help</button><span>© ChartMasters</span></div>
      </footer>
    </main>
  );
}

function RulerIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 13-13 5 5L8 21z"/><path d="m14 5 5 5M11 8l2 2M8 11l2 2M5 14l2 2"/></svg>;
}
