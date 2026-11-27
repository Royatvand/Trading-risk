// Tiny Pine Script tokenizer used only to colour the editor. It never throws and
// always returns the original text split into spans, so it cannot lose characters.

export type HighlightSpan = { text: string; cls?: string };

const KEYWORDS = new Set([
  "if", "else", "for", "to", "by", "while", "break", "continue", "var", "varip",
  "and", "or", "not", "true", "false", "switch", "import", "export", "method", "type",
]);
const TYPES = new Set(["int", "float", "bool", "string", "color", "series", "simple", "const"]);
const SERIES = new Set([
  "open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4", "hlcc4", "time", "bar_index", "na",
]);
const NAMESPACES = new Set([
  "ta", "math", "color", "input", "plot", "hline", "str", "barstate", "syminfo",
  "timeframe", "shape", "location", "size", "display", "format", "extend",
]);

const CHAIN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/;
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const COLOR = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?/;

export function highlightLine(line: string): HighlightSpan[] {
  const out: HighlightSpan[] = [];
  const push = (text: string, cls?: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.cls === cls) last.text += text;
    else out.push({ text, cls });
  };

  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    const c = rest[0];

    if (c === "/" && rest[1] === "/") {
      push(rest, /^\/\/\s*@/.test(rest) ? "tk-annot" : "tk-comment");
      break;
    }

    if (c === '"' || c === "'") {
      let j = 1;
      while (j < rest.length && rest[j] !== c) j += rest[j] === "\\" ? 2 : 1;
      const end = Math.min(rest.length, j + 1);
      push(rest.slice(0, end), "tk-string");
      i += end;
      continue;
    }

    const color = COLOR.exec(rest);
    if (color) {
      push(color[0], "tk-number");
      i += color[0].length;
      continue;
    }

    const number = /[0-9]|\./.test(c) ? NUMBER.exec(rest) : null;
    if (number) {
      push(number[0], "tk-number");
      i += number[0].length;
      continue;
    }

    const chain = CHAIN.exec(rest);
    if (chain) {
      const word = chain[0];
      const after = rest[word.length];
      const isCall = after === "(";
      const dot = word.indexOf(".");
      if (dot > 0 && NAMESPACES.has(word.slice(0, dot))) {
        push(word.slice(0, dot), "tk-ns");
        push(".");
        push(word.slice(dot + 1), isCall ? "tk-fn" : "tk-const");
      } else if (dot > 0) {
        push(word);
      } else if (KEYWORDS.has(word)) {
        push(word, "tk-keyword");
      } else if (TYPES.has(word) && !isCall) {
        push(word, "tk-type");
      } else if (SERIES.has(word) && !isCall) {
        push(word, "tk-series");
      } else if (isCall) {
        push(word, "tk-fn");
      } else {
        push(word);
      }
      i += word.length;
      continue;
    }

    push(c);
    i += 1;
  }

  return out;
}
