import type { MarketCandle } from "@/features/market-data/types";

export type EmaPeriod = 20 | 50 | 200;
export type OscillatorType = "none" | "rsi" | "macd";
export type IndicatorPoint = { time: number; value: number };

export type MacdResult = {
  macd: IndicatorPoint[];
  signal: IndicatorPoint[];
  histogram: IndicatorPoint[];
};

function toPoint(candle: MarketCandle, value: number): IndicatorPoint {
  return { time: Math.floor(candle.openTime / 1000), value };
}

function emaValues(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (period < 1 || values.length < period) return result;

  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  let current = seed;
  result[period - 1] = current;

  const multiplier = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
    result[index] = current;
  }

  return result;
}

export function calculateEMA(candles: MarketCandle[], period: EmaPeriod): IndicatorPoint[] {
  const values = emaValues(candles.map((candle) => candle.close), period);
  return values.flatMap((value, index) =>
    value === null ? [] : [toPoint(candles[index], value)]
  );
}

export function calculateRSI(candles: MarketCandle[], period = 14): IndicatorPoint[] {
  if (period < 1 || candles.length <= period) return [];

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    averageGain += Math.max(change, 0);
    averageLoss += Math.max(-change, 0);
  }

  averageGain /= period;
  averageLoss /= period;

  const result: IndicatorPoint[] = [];
  const valueFor = (gain: number, loss: number) => {
    if (loss === 0) return gain === 0 ? 50 : 100;
    const relativeStrength = gain / loss;
    return 100 - 100 / (1 + relativeStrength);
  };

  result.push(toPoint(candles[period], valueFor(averageGain, averageLoss)));

  for (let index = period + 1; index < candles.length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    result.push(toPoint(candles[index], valueFor(averageGain, averageLoss)));
  }

  return result;
}

export function calculateMACD(
  candles: MarketCandle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MacdResult {
  const empty: MacdResult = { macd: [], signal: [], histogram: [] };
  if (
    fastPeriod < 1 ||
    slowPeriod <= fastPeriod ||
    signalPeriod < 1 ||
    candles.length < slowPeriod + signalPeriod - 1
  ) {
    return empty;
  }

  const closes = candles.map((candle) => candle.close);
  const fast = emaValues(closes, fastPeriod);
  const slow = emaValues(closes, slowPeriod);
  const macdValues: Array<number | null> = closes.map((_, index) =>
    fast[index] === null || slow[index] === null
      ? null
      : (fast[index] as number) - (slow[index] as number)
  );

  const firstMacdIndex = slowPeriod - 1;
  const validMacd = macdValues.slice(firstMacdIndex).filter(
    (value): value is number => value !== null
  );
  const signalValues = emaValues(validMacd, signalPeriod);

  const macd: IndicatorPoint[] = [];
  const signal: IndicatorPoint[] = [];
  const histogram: IndicatorPoint[] = [];

  for (let index = firstMacdIndex; index < candles.length; index += 1) {
    const macdValue = macdValues[index];
    if (macdValue === null) continue;

    macd.push(toPoint(candles[index], macdValue));

    const signalIndex = index - firstMacdIndex;
    const signalValue = signalValues[signalIndex];
    if (signalValue === null || signalValue === undefined) continue;

    signal.push(toPoint(candles[index], signalValue));
    histogram.push(toPoint(candles[index], macdValue - signalValue));
  }

  return { macd, signal, histogram };
}
