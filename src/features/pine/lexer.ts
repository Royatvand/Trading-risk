import { PineError } from "./types";

export type TokenKind = "num" | "str" | "id" | "op" | "color" | "nl" | "indent" | "dedent" | "eof";

export type Token = { k: TokenKind; v: string; line: number };

// Operators / keywords that mean "this logical line is not finished yet".
const CONTINUATION_END = new Set([
  "+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=",
  "and", "or", "not", ",", "?", ":", "=", ":=", "+=", "-=", "*=", "/=", "%=", ".",
]);

// A line that starts with one of these continues the previous line.
const CONTINUATION_START = new Set([
  "?", ":", "and", "or", "+", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", ".",
]);

const TWO_CHAR_OPS = [":=", "=>", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%="];
const ONE_CHAR_OPS = "+-*/%<>=()[],.?:";

function scanLine(s: string, line: number): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    if (c === " " || c === "\t") {
      i += 1;
      continue;
    }
    if (c === "/" && s[i + 1] === "/") break; // comment

    if (c === '"' || c === "'") {
      let j = i + 1;
      let text = "";
      while (j < s.length && s[j] !== c) {
        if (s[j] === "\\" && j + 1 < s.length) {
          const n = s[j + 1];
          text += n === "n" ? "\n" : n === "t" ? "\t" : n;
          j += 2;
        } else {
          text += s[j];
          j += 1;
        }
      }
      if (j >= s.length) throw new PineError(line, "Unterminated string");
      out.push({ k: "str", v: text, line });
      i = j + 1;
      continue;
    }

    if (c === "#") {
      const m = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?/.exec(s.slice(i));
      if (!m) throw new PineError(line, "Invalid color literal");
      out.push({ k: "color", v: m[0], line });
      i += m[0].length;
      continue;
    }

    const prev = out[out.length - 1];
    const prevEndsValue = prev && (prev.k === "id" || prev.v === ")" || prev.v === "]");

    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] ?? "") && !prevEndsValue)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new PineError(line, "Invalid number");
      out.push({ k: "num", v: m[0], line });
      i += m[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
      if (!m) throw new PineError(line, "Invalid identifier");
      out.push({ k: "id", v: m[0], line });
      i += m[0].length;
      continue;
    }

    const two = s.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      out.push({ k: "op", v: two, line });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.includes(c)) {
      out.push({ k: "op", v: c, line });
      i += 1;
      continue;
    }

    throw new PineError(line, "Unexpected character '" + c + "'");
  }

  return out;
}

function leadingIndent(raw: string): number {
  let n = 0;
  for (const ch of raw) {
    if (ch === " ") n += 1;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
}

export function lex(source: string): Token[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: Token[] = [];
  const indents = [0];
  let depth = 0;
  let continuing = false;

  for (let li = 0; li < lines.length; li += 1) {
    const raw = lines[li];
    const lineNo = li + 1;
    const toks = scanLine(raw, lineNo);
    if (toks.length === 0) continue;

    let joined = false;
    const last = out[out.length - 1];
    const first = toks[0];
    if (
      !continuing && depth === 0 && last && last.k === "nl" &&
      (first.k === "op" || first.k === "id") && CONTINUATION_START.has(first.v)
    ) {
      out.pop(); // glue this line onto the previous one
      joined = true;
    }

    if (!continuing && depth === 0 && !joined) {
      const ind = leadingIndent(raw);
      const top = indents[indents.length - 1];
      if (ind > top) {
        indents.push(ind);
        out.push({ k: "indent", v: "", line: lineNo });
      } else if (ind < top) {
        while (indents.length > 1 && ind < indents[indents.length - 1]) {
          indents.pop();
          out.push({ k: "dedent", v: "", line: lineNo });
        }
        if (ind !== indents[indents.length - 1]) {
          throw new PineError(lineNo, "Inconsistent indentation");
        }
      }
    }

    for (const t of toks) {
      if (t.k === "op") {
        if (t.v === "(" || t.v === "[") depth += 1;
        else if (t.v === ")" || t.v === "]") depth = Math.max(0, depth - 1);
      }
      out.push(t);
    }

    const tail = toks[toks.length - 1];
    continuing = depth > 0 || ((tail.k === "op" || tail.k === "id") && CONTINUATION_END.has(tail.v));
    if (!continuing) out.push({ k: "nl", v: "", line: lineNo });
  }

  const lastTok = out[out.length - 1];
  if (lastTok && lastTok.k !== "nl") out.push({ k: "nl", v: "", line: lastTok.line });
  while (indents.length > 1) {
    indents.pop();
    out.push({ k: "dedent", v: "", line: lines.length });
  }
  out.push({ k: "eof", v: "", line: lines.length });
  return out;
}
