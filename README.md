# ChartMasters Terminal

A TradingView-inspired cryptocurrency charting workspace built with Next.js, TypeScript, Lightweight Charts and Lucide icons.

## Current stage

This branch replaces the previous MT5/MQL5 prototype with a web application foundation.

- Trading terminal UI shell
- Responsive chart workspace
- Lightweight Charts candlestick chart
- Demo/mock OHLCV data only
- Symbol and timeframe selection
- Binance Spot REST history and live WebSocket candles
- Paginated older candle history
- Persistent trend line, rectangle and Fibonacci drawings
- EMA 20 / 50 / 200, RSI 14 and MACD 12 / 26 / 9 indicators
- Watchlist and drawing toolbar
- Pine Script editor: run your own Pine v5 indicator code on the chart (see below)

## Pine Script

Open the **Pine** button in the toolbar (or the *Pine Editor* tab), write an indicator and press **Add to chart** (Ctrl+Enter). The script is saved in the browser and re-applied on reload; it re-runs on every candle update and when the symbol or timeframe changes.

Scripts are executed by a built-in interpreter (`src/features/pine`) — no `eval`, no network access and no TradingView dependency.

Supported subset of Pine v5: `indicator()`, `plot()` (line / histogram / circles, per-bar colors), `hline()`, `input.*` (default values), `var`, `:=` and compound assignment, `if` / `else`, `for`, `while`, user-defined functions, tuples, `series[n]` history, `ta.sma/ema/rma/wma/vwma/rsi/stdev/highest/lowest/change/roc/cum/crossover/crossunder/tr/atr/macd/bb/stoch`, `math.*`, `color.*`, `nz()`, `na()`.

Not supported yet: strategies and backtesting, `plotshape` / `plotchar` / `bgcolor` / `fill`, `label` / `line` / `box` / `table` objects, arrays and maps, `request.*`, and `input.*` controls (inputs use their default value).

## Not connected yet

- Persistent cloud workspaces and cross-device drawing sync
- Authentication and subscriptions
- Alert delivery and strategy testing

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Next milestone

Expand the technical analysis toolkit with configurable studies, then add chart alerts and synchronized user workspaces. Keep market-data providers separate from chart rendering so additional exchanges can be added later.

## Licensing note

This project uses Lightweight Charts under its Apache 2.0 license. It does not bundle TradingView Advanced Charts or proprietary TradingView UI assets.
