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
