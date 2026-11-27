export type PineExample = { name: string; source: string };

export const PINE_EXAMPLES: PineExample[] = [
  {
    name: "Moving average cross",
    source: `//@version=5
indicator("MA Cross", overlay=true)

fastLen = input.int(9, "Fast length")
slowLen = input.int(21, "Slow length")

fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)

plot(fast, "Fast EMA", color=color.orange, linewidth=2)
plot(slow, "Slow EMA", color=color.blue, linewidth=2)
`,
  },
  {
    name: "RSI",
    source: `//@version=5
indicator("RSI", overlay=false)

len = input.int(14, "Length")
value = ta.rsi(close, len)

plot(value, "RSI", color=color.purple, linewidth=2)
hline(70, "Overbought", color=color.red)
hline(30, "Oversold", color=color.green)
`,
  },
  {
    name: "MACD",
    source: `//@version=5
indicator("MACD", overlay=false)

[macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)

plot(hist, "Histogram", style=plot.style_histogram,
     color = hist >= 0 ? color.new(color.green, 30) : color.new(color.red, 30))
plot(macdLine, "MACD", color=color.blue)
plot(signalLine, "Signal", color=color.orange)
hline(0, "Zero", color=color.gray)
`,
  },
  {
    name: "Bollinger Bands",
    source: `//@version=5
indicator("Bollinger Bands", overlay=true)

len = input.int(20, "Length")
mult = input.float(2.0, "Multiplier")

[basis, upper, lower] = ta.bb(close, len, mult)

plot(basis, "Basis", color=color.orange)
plot(upper, "Upper", color=color.blue)
plot(lower, "Lower", color=color.blue)
`,
  },
  {
    name: "Custom logic (var, if, functions)",
    source: `//@version=5
indicator("Trend counter", overlay=false)

// A user-defined function
average(a, b) => (a + b) / 2

var int streak = 0
if close > open
    streak := streak > 0 ? streak + 1 : 1
else if close < open
    streak := streak < 0 ? streak - 1 : -1

smooth = ta.sma(streak, 5)
plot(streak, "Streak", style=plot.style_histogram,
     color = streak >= 0 ? color.green : color.red)
plot(smooth, "Smoothed", color=color.yellow, linewidth=2)
plot(average(high, low) > close ? 1 : 0, "Below midpoint", color=color.gray)
`,
  },
];

export const DEFAULT_PINE_SOURCE = PINE_EXAMPLES[0].source;
