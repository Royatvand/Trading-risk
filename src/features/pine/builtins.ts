import type { MarketCandle } from "../market-data/types";
import {
  PineError,
  type PineDiagnostic,
  type PineHLine,
  type PinePlot,
  type PlotPoint,
  type PlotStyle,
  type PineValue,
} from "./types";

type V = PineValue;
export type Args = Record<string, V | undefined>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CallState = Record<string, any>;

export type PlotAccum = Omit<PinePlot, "points"> & {
  hasExplicitColor: boolean;
  points: Array<PlotPoint | undefined>;
};

export type Ctx = {
  candles: MarketCandle[];
  bar: number;
  symbol: string;
  timeframe: string;
  plots: Map<object, PlotAccum>;
  hlines: Map<object, PineHLine>;
  meta: { title: string; overlay: boolean };
  warnings: PineDiagnostic[];
  warn: (line: number, message: string) => void;
};

export type Builtin = {
  params: string[];
  f: (a: Args, c: Ctx, st: CallState, line: number) => V;
};

// ---------------------------------------------------------------- helpers

export function num(v: V | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return NaN;
}

export function truthy(v: V | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return !Number.isNaN(v) && v !== 0;
  return false;
}

function text(v: V | undefined, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function series(st: CallState, key: string): number[] {
  if (!st[key]) st[key] = [];
  return st[key] as number[];
}

function put(st: CallState, key: string, bar: number, value: number): number[] {
  const a = series(st, key);
  a[bar] = value;
  return a;
}

function at(a: number[], i: number): number {
  const v = i < 0 ? undefined : a[i];
  return v === undefined ? NaN : v;
}

function length(v: V | undefined, line: number, name: string): number {
  const n = Math.floor(num(v));
  if (!(n >= 1)) throw new PineError(line, name + ": length must be a number >= 1");
  return n;
}

function windowValues(a: number[], bar: number, len: number): number[] | null {
  if (bar < len - 1) return null;
  const out: number[] = [];
  for (let i = 0; i < len; i += 1) {
    const v = at(a, bar - i);
    if (Number.isNaN(v)) return null;
    out.push(v);
  }
  return out;
}

function smaCore(st: CallState, key: string, bar: number, src: number, len: number): number {
  const a = put(st, key, bar, src);
  const w = windowValues(a, bar, len);
  if (!w) return NaN;
  let sum = 0;
  for (const v of w) sum += v;
  return sum / len;
}

function stdevCore(st: CallState, key: string, bar: number, src: number, len: number): number {
  const a = put(st, key, bar, src);
  const w = windowValues(a, bar, len);
  if (!w) return NaN;
  let mean = 0;
  for (const v of w) mean += v;
  mean /= len;
  let variance = 0;
  for (const v of w) variance += (v - mean) * (v - mean);
  return Math.sqrt(variance / len);
}

// EMA-style smoothing. Seeds with the SMA of the first `len` valid values,
// which is how Pine initialises ta.ema / ta.rma.
function emaCore(
  st: CallState, key: string, bar: number, src: number, len: number, alpha: number
): number {
  const a = put(st, key + "_s", bar, src);
  const prev = st[key + "_p"] as number | undefined;
  if (prev === undefined) {
    const w = windowValues(a, bar, len);
    if (!w) return NaN;
    let sum = 0;
    for (const v of w) sum += v;
    const seed = sum / len;
    st[key + "_p"] = seed;
    return seed;
  }
  if (Number.isNaN(src)) return NaN;
  const next = alpha * src + (1 - alpha) * prev;
  st[key + "_p"] = next;
  return next;
}

function rsiCore(st: CallState, key: string, bar: number, src: number, len: number): number {
  const a = put(st, key + "_src", bar, src);
  const change = src - at(a, bar - 1);
  const up = emaCore(st, key + "_u", bar, Number.isNaN(change) ? NaN : Math.max(change, 0), len, 1 / len);
  const down = emaCore(st, key + "_d", bar, Number.isNaN(change) ? NaN : Math.max(-change, 0), len, 1 / len);
  if (Number.isNaN(up) || Number.isNaN(down)) return NaN;
  if (down === 0) return 100;
  if (up === 0) return 0;
  return 100 - 100 / (1 + up / down);
}

export function trueRange(candles: MarketCandle[], bar: number): number {
  const c = candles[bar];
  if (!c) return NaN;
  if (bar === 0) return c.high - c.low;
  const pc = candles[bar - 1].close;
  return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
}

function extreme(
  st: CallState, key: string, bar: number, src: number, len: number, pickMax: boolean
): number {
  const a = put(st, key, bar, src);
  if (bar < len - 1) return NaN;
  let best = NaN;
  for (let i = 0; i < len; i += 1) {
    const v = at(a, bar - i);
    if (Number.isNaN(v)) continue;
    if (Number.isNaN(best) || (pickMax ? v > best : v < best)) best = v;
  }
  return best;
}

// ---------------------------------------------------------------- colors

export const COLORS: Record<string, string> = {
  aqua: "#00BCD4", black: "#363A45", blue: "#2962FF", fuchsia: "#E040FB",
  gray: "#787B86", green: "#4CAF50", lime: "#00E676", maroon: "#880E4F",
  navy: "#311B92", olive: "#808000", orange: "#FF9800", purple: "#9C27B0",
  red: "#F23645", silver: "#B2B5BE", teal: "#089981", white: "#FFFFFF",
  yellow: "#FFEB3B",
};

function toRgb(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/.exec(color);
  if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function rgba(r: number, g: number, b: number, transparency: number): string {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  const t = Number.isNaN(transparency) ? 0 : Math.max(0, Math.min(100, transparency));
  return "rgba(" + clamp(r) + ", " + clamp(g) + ", " + clamp(b) + ", " + (1 - t / 100).toFixed(3) + ")";
}

// ---------------------------------------------------------------- tables

const CONSTANTS: Record<string, V> = {
  "math.pi": Math.PI,
  "math.e": Math.E,
  "plot.style_line": "line",
  "plot.style_linebr": "line",
  "plot.style_stepline": "line",
  "plot.style_histogram": "histogram",
  "plot.style_columns": "histogram",
  "plot.style_area": "line",
  "plot.style_areabr": "line",
  "plot.style_circles": "circles",
  "plot.style_cross": "circles",
  "hline.style_solid": "solid",
  "hline.style_dotted": "dotted",
  "hline.style_dashed": "dashed",
  "display.all": "all",
  "display.none": "none",
  "display.pane": "pane",
  "format.price": "price",
  "format.volume": "volume",
  "format.percent": "percent",
  "extend.none": "none",
  "extend.left": "left",
  "extend.right": "right",
  "extend.both": "both",
};
for (const [name, hex] of Object.entries(COLORS)) CONSTANTS["color." + name] = hex;
for (const name of ["arrowup", "arrowdown", "circle", "cross", "diamond", "flag", "labeldown",
  "labelup", "square", "triangledown", "triangleup", "xcross"]) CONSTANTS["shape." + name] = name;
for (const name of ["abovebar", "belowbar", "top", "bottom", "absolute"]) CONSTANTS["location." + name] = name;
for (const name of ["auto", "tiny", "small", "normal", "large", "huge"]) CONSTANTS["size." + name] = name;

export function constant(name: string): V | undefined {
  return CONSTANTS[name];
}

export function isSeriesName(name: string): boolean {
  return ["open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4", "hlcc4", "time", "bar_index"].includes(name);
}

export function seriesValue(c: Ctx, name: string, bar: number): number {
  const k = c.candles[bar];
  if (!k) return NaN;
  switch (name) {
    case "open": return k.open;
    case "high": return k.high;
    case "low": return k.low;
    case "close": return k.close;
    case "volume": return k.volume;
    case "hl2": return (k.high + k.low) / 2;
    case "hlc3": return (k.high + k.low + k.close) / 3;
    case "ohlc4": return (k.open + k.high + k.low + k.close) / 4;
    case "hlcc4": return (k.high + k.low + 2 * k.close) / 4;
    case "time": return k.openTime;
    case "bar_index": return bar;
    default: return NaN;
  }
}

// Variables addressed by a dotted name (no call).
export function dottedVariable(c: Ctx, name: string): V | undefined {
  const known = CONSTANTS[name];
  if (known !== undefined) return known;
  switch (name) {
    case "ta.tr": return trueRange(c.candles, c.bar);
    case "barstate.isfirst": return c.bar === 0;
    case "barstate.islast": return c.bar === c.candles.length - 1;
    case "barstate.isconfirmed": return c.bar < c.candles.length - 1;
    case "barstate.ishistory": return c.bar < c.candles.length - 1;
    case "barstate.isrealtime": return c.bar === c.candles.length - 1;
    case "syminfo.ticker": return c.symbol;
    case "syminfo.tickerid": return "BINANCE:" + c.symbol;
    case "timeframe.period": return c.timeframe;
    default: return undefined;
  }
}

// ---------------------------------------------------------------- builtins

const PALETTE = ["#2962FF", "#FF9800", "#E040FB", "#00BCD4", "#4CAF50", "#F23645"];

const UNSUPPORTED = [
  "bgcolor", "barcolor", "fill", "plotshape", "plotchar", "plotarrow", "plotcandle", "plotbar",
  "alertcondition", "alert", "label.new", "label.set_text", "line.new", "box.new", "table.new",
];

const builtins: Record<string, Builtin> = {};

function def(name: string, params: string[], f: Builtin["f"]) {
  builtins[name] = { params, f };
}

// declarations
for (const name of ["indicator", "study"]) {
  def(name, ["title", "shorttitle", "overlay"], (a, c) => {
    c.meta.title = text(a.title, text(a.shorttitle, c.meta.title));
    if (typeof a.overlay === "boolean") c.meta.overlay = a.overlay;
    return NaN;
  });
}
def("strategy", ["title", "shorttitle", "overlay"], (a, c, _st, line) => {
  c.meta.title = text(a.title, text(a.shorttitle, c.meta.title));
  if (typeof a.overlay === "boolean") c.meta.overlay = a.overlay;
  c.warn(line, "strategy() is run as an indicator: orders and backtesting are not supported yet.");
  return NaN;
});

// inputs just return their default value for now
for (const name of ["input", "input.int", "input.float", "input.bool", "input.string",
  "input.color", "input.source", "input.timeframe", "input.symbol", "input.price", "input.time"]) {
  def(name, ["defval", "title", "tooltip", "inline", "group"], (a) =>
    a.defval === undefined ? NaN : a.defval);
}

for (const name of UNSUPPORTED) {
  def(name, [], (_a, c, _st, line) => {
    c.warn(line, name + "() is not supported yet and was ignored.");
    return NaN;
  });
}

// output
def("plot", ["series", "title", "color", "linewidth", "style", "trackprice", "histbase", "offset",
  "join", "editable", "show_last", "display"], (a, c, st, line) => {
  let acc = c.plots.get(st);
  if (!acc) {
    const style: PlotStyle = a.style === "histogram" || a.style === "circles" ? a.style : "line";
    acc = {
      title: text(a.title, "Plot " + (c.plots.size + 1)),
      color: PALETTE[c.plots.size % PALETTE.length],
      lineWidth: Math.max(1, Math.min(4, Math.floor(num(a.linewidth)) || 1)),
      style,
      hasExplicitColor: false,
      points: [],
    };
    c.plots.set(st, acc);
  }
  const value = num(a.series);
  const color = typeof a.color === "string" ? a.color : undefined;
  if (color && !acc.hasExplicitColor) {
    acc.color = color;
    acc.hasExplicitColor = true;
  }
  const time = Math.floor(c.candles[c.bar].openTime / 1000);
  if (typeof a.series !== "number" && typeof a.series !== "boolean") {
    throw new PineError(line, "plot() expects a numeric series");
  }
  acc.points[c.bar] = Number.isNaN(value) ? { time } : { time, value, color };
  return value;
});

def("hline", ["price", "title", "color", "linestyle", "linewidth", "editable", "display"], (a, c, st) => {
  const style = a.linestyle === "solid" || a.linestyle === "dotted" ? a.linestyle : "dashed";
  c.hlines.set(st, {
    title: text(a.title, "Level"),
    price: num(a.price),
    color: typeof a.color === "string" ? a.color : "#787B86",
    lineWidth: Math.max(1, Math.min(4, Math.floor(num(a.linewidth)) || 1)),
    lineStyle: style,
  });
  return NaN;
});

// colors
def("color.new", ["color", "transp"], (a) => {
  const rgb = toRgb(text(a.color, "#2962FF"));
  if (!rgb) return text(a.color, "#2962FF");
  return rgba(rgb[0], rgb[1], rgb[2], num(a.transp));
});
def("color.rgb", ["red", "green", "blue", "transp"], (a) =>
  rgba(num(a.red), num(a.green), num(a.blue), a.transp === undefined ? 0 : num(a.transp)));

// technical analysis
def("ta.sma", ["source", "length"], (a, c, st, line) =>
  smaCore(st, "a", c.bar, num(a.source), length(a.length, line, "ta.sma")));

def("ta.ema", ["source", "length"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.ema");
  return emaCore(st, "e", c.bar, num(a.source), len, 2 / (len + 1));
});

def("ta.rma", ["source", "length"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.rma");
  return emaCore(st, "r", c.bar, num(a.source), len, 1 / len);
});

def("ta.wma", ["source", "length"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.wma");
  const arr = put(st, "a", c.bar, num(a.source));
  const w = windowValues(arr, c.bar, len);
  if (!w) return NaN;
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += w[i] * (len - i);
  return sum / ((len * (len + 1)) / 2);
});

def("ta.vwma", ["source", "length"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.vwma");
  const arr = put(st, "a", c.bar, num(a.source) * c.candles[c.bar].volume);
  const w = windowValues(arr, c.bar, len);
  let vol = 0;
  for (let i = 0; i < len && c.bar - i >= 0; i += 1) vol += c.candles[c.bar - i].volume;
  if (!w || vol === 0) return NaN;
  let sum = 0;
  for (const v of w) sum += v;
  return sum / vol;
});

def("ta.rsi", ["source", "length"], (a, c, st, line) =>
  rsiCore(st, "r", c.bar, num(a.source), length(a.length, line, "ta.rsi")));

def("ta.stdev", ["source", "length", "biased"], (a, c, st, line) =>
  stdevCore(st, "a", c.bar, num(a.source), length(a.length, line, "ta.stdev")));

for (const [name, pickMax] of [["ta.highest", true], ["ta.lowest", false]] as const) {
  def(name, ["source", "length"], (a, c, st, line) => {
    // highest(len) uses the bar high / low, like Pine.
    const single = a.length === undefined;
    const src = single ? (pickMax ? c.candles[c.bar].high : c.candles[c.bar].low) : num(a.source);
    const len = length(single ? a.source : a.length, line, name);
    return extreme(st, "a", c.bar, src, len, pickMax);
  });
}

def("ta.change", ["source", "length"], (a, c, st) => {
  const len = a.length === undefined ? 1 : Math.max(1, Math.floor(num(a.length)));
  const src = num(a.source);
  const arr = put(st, "a", c.bar, src);
  return src - at(arr, c.bar - len);
});
builtins["ta.mom"] = builtins["ta.change"];

def("ta.roc", ["source", "length"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.roc");
  const src = num(a.source);
  const arr = put(st, "a", c.bar, src);
  const old = at(arr, c.bar - len);
  return old === 0 ? NaN : (100 * (src - old)) / old;
});

def("ta.cum", ["source"], (a, c, st) => {
  const v = num(a.source);
  const total = ((st.total as number | undefined) ?? 0) + (Number.isNaN(v) ? 0 : v);
  st.total = total;
  return total;
});

def("ta.crossover", ["source1", "source2"], (a, _c, st) => {
  const x = num(a.source1);
  const y = num(a.source2);
  const px = st.px as number | undefined;
  const py = st.py as number | undefined;
  st.px = x;
  st.py = y;
  return px !== undefined && py !== undefined && x > y && px <= py;
});

def("ta.crossunder", ["source1", "source2"], (a, _c, st) => {
  const x = num(a.source1);
  const y = num(a.source2);
  const px = st.px as number | undefined;
  const py = st.py as number | undefined;
  st.px = x;
  st.py = y;
  return px !== undefined && py !== undefined && x < y && px >= py;
});

def("ta.cross", ["source1", "source2"], (a, c, st, line) => {
  const up = builtins["ta.crossover"].f(a, c, (st.up ??= {}), line);
  const down = builtins["ta.crossunder"].f(a, c, (st.down ??= {}), line);
  return up === true || down === true;
});

def("ta.tr", ["handle_na"], (_a, c) => trueRange(c.candles, c.bar));

def("ta.atr", ["length"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.atr");
  return emaCore(st, "r", c.bar, trueRange(c.candles, c.bar), len, 1 / len);
});

def("ta.macd", ["source", "fastlen", "slowlen", "siglen"], (a, c, st, line) => {
  const fast = length(a.fastlen, line, "ta.macd");
  const slow = length(a.slowlen, line, "ta.macd");
  const sig = length(a.siglen, line, "ta.macd");
  const src = num(a.source);
  const f = emaCore(st, "f", c.bar, src, fast, 2 / (fast + 1));
  const s = emaCore(st, "s", c.bar, src, slow, 2 / (slow + 1));
  const macd = f - s;
  const signal = emaCore(st, "g", c.bar, macd, sig, 2 / (sig + 1));
  return [macd, signal, macd - signal];
});

def("ta.bb", ["series", "length", "mult"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.bb");
  const mult = num(a.mult);
  const src = num(a.series);
  const basis = smaCore(st, "m", c.bar, src, len);
  const dev = mult * stdevCore(st, "d", c.bar, src, len);
  return [basis, basis + dev, basis - dev];
});

def("ta.stoch", ["source", "high", "low", "length"], (a, c, st, line) => {
  const len = length(a.length, line, "ta.stoch");
  const hi = extreme(st, "h", c.bar, num(a.high), len, true);
  const lo = extreme(st, "l", c.bar, num(a.low), len, false);
  const src = num(a.source);
  if (Number.isNaN(hi) || Number.isNaN(lo) || hi === lo) return NaN;
  return (100 * (src - lo)) / (hi - lo);
});

// math
const unaryMath: Record<string, (x: number) => number> = {
  abs: Math.abs, sqrt: Math.sqrt, log: Math.log, log10: Math.log10, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, sign: Math.sign,
};
for (const [name, fn] of Object.entries(unaryMath)) {
  def("math." + name, ["x"], (a) => fn(num(a.x)));
}
def("math.round", ["x", "precision"], (a) => {
  const x = num(a.x);
  if (a.precision === undefined) return Math.round(x);
  const p = Math.pow(10, Math.floor(num(a.precision)));
  return Math.round(x * p) / p;
});
def("math.pow", ["base", "exponent"], (a) => Math.pow(num(a.base), num(a.exponent)));
def("math.max", ["a", "b", "c", "d", "e", "f"], (a) => {
  const vals = ["a", "b", "c", "d", "e", "f"].map((k) => a[k]).filter((v) => v !== undefined).map(num);
  return vals.some(Number.isNaN) ? NaN : Math.max(...vals);
});
def("math.min", ["a", "b", "c", "d", "e", "f"], (a) => {
  const vals = ["a", "b", "c", "d", "e", "f"].map((k) => a[k]).filter((v) => v !== undefined).map(num);
  return vals.some(Number.isNaN) ? NaN : Math.min(...vals);
});
def("math.avg", ["a", "b", "c", "d", "e", "f"], (a) => {
  const vals = ["a", "b", "c", "d", "e", "f"].map((k) => a[k]).filter((v) => v !== undefined).map(num);
  return vals.some(Number.isNaN) ? NaN : vals.reduce((s, v) => s + v, 0) / vals.length;
});
def("math.sum", ["source", "length"], (a, c, st, line) => {
  const len = length(a.length, line, "math.sum");
  const arr = put(st, "a", c.bar, num(a.source));
  const w = windowValues(arr, c.bar, len);
  return w ? w.reduce((s, v) => s + v, 0) : NaN;
});

// conversions
def("nz", ["source", "replacement"], (a) => {
  const v = num(a.source);
  return Number.isNaN(v) ? (a.replacement === undefined ? 0 : num(a.replacement)) : v;
});
def("na", ["x"], (a) => typeof a.x === "number" && Number.isNaN(a.x));
def("int", ["x"], (a) => Math.trunc(num(a.x)));
def("float", ["x"], (a) => num(a.x));
def("bool", ["x"], (a) => truthy(a.x));
def("str.tostring", ["value", "format"], (a) => {
  const v = a.value;
  if (typeof v === "number") return Number.isNaN(v) ? "NaN" : String(v);
  if (typeof v === "boolean" || typeof v === "string") return String(v);
  return "";
});
builtins["str.tostring"].params = ["value", "format"];

export function findBuiltin(name: string): Builtin | undefined {
  return builtins[name] ?? builtins["ta." + name] ?? builtins["math." + name];
}

export { text as asText };
