# ChartMasters Terminal

A TradingView-inspired cryptocurrency charting workspace built with Next.js, TypeScript, Lightweight Charts and Lucide icons.

## Current stage

This branch replaces the previous MT5/MQL5 prototype with a web application foundation.

- Trading terminal UI shell
- Responsive chart workspace
- Lightweight Charts candlestick chart
- Demo/mock OHLCV data only
- Symbol and timeframe selection
- Watchlist and drawing toolbar UI

## Not connected yet

- Binance REST API
- Binance WebSocket streams
- Persistent user workspaces
- Authentication and subscriptions
- Functional drawing overlays and indicator calculations

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Next milestone

Connect Binance Spot market data through a provider adapter, load historical klines, then subscribe to WebSocket kline updates. Keep provider code separate from chart rendering so additional market-data providers can be added later.

## Licensing note

This project uses Lightweight Charts under its Apache 2.0 license. It does not bundle TradingView Advanced Charts or proprietary TradingView UI assets.
