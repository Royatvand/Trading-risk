export type ChartInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W";

export type MarketCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketConnectionStatus = "loading" | "connecting" | "live" | "reconnecting" | "error";

export type Ticker24h = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
};
