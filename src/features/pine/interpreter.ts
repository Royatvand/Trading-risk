import type { MarketCandle } from "../market-data/types";
import {
  dottedVariable,
  findBuiltin,
  isSeriesName,
  num,
  seriesValue,
  truthy,
  type Args,
  type CallState,
  type Ctx,
} from "./builtins";
import { parse, type Arg, type Expr, type IfStmt, type Param, type Stmt } from "./parser";
import { PineError, type PineDiagnostic, type PineResult, type PineValue } from "./types";

type V = PineValue;

// Bound synchronous user scripts so runaway loops cannot freeze the chart UI.
const MAX_STEPS = 1_000_000;

class BreakSignal {}
class ContinueSignal {}

class Scope {
  vars = new Map<string, V>();
  constructor(public parent: Scope | null) {}

  owner(name: string): Scope | null {
    for (let s: Scope | null = this; s; s = s.parent) {
      if (s.vars.has(name)) return s;
    }
    return null;
  }
}

type UserFunc = { params: Param[]; body: Stmt[] };

class Interpreter {
  private global = new Scope(null);
  private funcs = new Map<string, UserFunc>();
  private states = new WeakMap<object, CallState>();
  private history = new Map<string, V[]>();
  private steps = 0;
  readonly ctx: Ctx;

  constructor(candles: MarketCandle[], symbol: string, timeframe: string) {
    const warnings: PineDiagnostic[] = [];
    const seen = new Set<string>();
    this.ctx = {
      candles,
      bar: 0,
      symbol,
      timeframe,
      plots: new Map(),
      hlines: new Map(),
      meta: { title: "Pine script", overlay: false },
      warnings,
      warn: (line, message) => {
        if (seen.has(message)) return;
        seen.add(message);
        warnings.push({ line, message });
      },
    };
  }

  run(program: Stmt[]) {
    const n = this.ctx.candles.length;
    for (let bar = 0; bar < n; bar += 1) {
      this.ctx.bar = bar;
      this.execBlock(program, this.global, false);
      for (const [name, value] of this.global.vars) {
        let h = this.history.get(name);
        if (!h) {
          h = [];
          this.history.set(name, h);
        }
        h[bar] = value;
      }
    }
  }

  private stateOf(node: object): CallState {
    let st = this.states.get(node);
    if (!st) {
      st = {};
      this.states.set(node, st);
    }
    return st;
  }

  private tick(line: number) {
    this.steps += 1;
    if (this.steps > MAX_STEPS) {
      throw new PineError(line, "Script is too slow or contains an endless loop (execution limit reached)");
    }
  }

  // ------------------------------------------------------------ statements

  private execBlock(body: Stmt[], scope: Scope, newScope = true): V | undefined {
    const s = newScope ? new Scope(scope) : scope;
    let last: V | undefined;
    for (const stmt of body) last = this.exec(stmt, s);
    return last;
  }

  private exec(stmt: Stmt, scope: Scope): V | undefined {
    this.tick(stmt.line);
    switch (stmt.k) {
      case "decl": {
        if (stmt.isVar) {
          const st = this.stateOf(stmt);
          if (st.done) return undefined;
          st.done = true;
        }
        const value = this.eval(stmt.init, scope);
        if (stmt.names.length === 1) {
          scope.vars.set(stmt.names[0], value);
        } else {
          if (!Array.isArray(value) || value.length < stmt.names.length) {
            throw new PineError(stmt.line, "Cannot unpack the value into " + stmt.names.length + " variables");
          }
          stmt.names.forEach((n, i) => scope.vars.set(n, value[i]));
        }
        return value;
      }
      case "assign": {
        const owner = scope.owner(stmt.name);
        if (!owner) throw new PineError(stmt.line, "'" + stmt.name + "' is not declared; use '=' to declare it first");
        const value = this.eval(stmt.value, scope);
        owner.vars.set(stmt.name, value);
        return value;
      }
      case "if": {
        const cond = truthy(this.eval(stmt.cond, scope));
        return this.execBlock(cond ? stmt.then : stmt.else, scope);
      }
      case "for": {
        const from = Math.trunc(num(this.eval(stmt.from, scope)));
        const to = Math.trunc(num(this.eval(stmt.to, scope)));
        let by = stmt.by ? Math.trunc(num(this.eval(stmt.by, scope))) : from <= to ? 1 : -1;
        if (!by) by = 1;
        if (Number.isNaN(from) || Number.isNaN(to)) throw new PineError(stmt.line, "for loop bounds must be numbers");
        let last: V | undefined;
        for (let i = from; by > 0 ? i <= to : i >= to; i += by) {
          this.tick(stmt.line);
          const inner = new Scope(scope);
          inner.vars.set(stmt.v, i);
          try {
            last = this.execBlock(stmt.body, inner, false);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return last;
      }
      case "while": {
        let last: V | undefined;
        while (truthy(this.eval(stmt.cond, scope))) {
          this.tick(stmt.line);
          try {
            last = this.execBlock(stmt.body, scope);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return last;
      }
      case "func":
        this.funcs.set(stmt.name, { params: stmt.params, body: stmt.body });
        return undefined;
      case "expr":
        return this.eval(stmt.e, scope);
      case "break":
        throw new BreakSignal();
      case "continue":
        throw new ContinueSignal();
    }
  }

  // ----------------------------------------------------------- expressions

  private dotted(e: Expr): string | null {
    if (e.k === "id") return e.name;
    if (e.k === "member") {
      const base = this.dotted(e.obj);
      return base === null ? null : base + "." + e.prop;
    }
    return null;
  }

  private eval(e: Expr, scope: Scope): V {
    this.tick(e.line);
    switch (e.k) {
      case "num":
      case "str":
      case "bool":
        return e.v;
      case "id":
        return this.evalId(e.name, e.line, scope);
      case "array":
        return e.items.map((item) => this.eval(item, scope));
      case "unary": {
        const v = this.eval(e.e, scope);
        if (e.op === "not") return !truthy(v);
        const n = num(v);
        return e.op === "-" ? -n : n;
      }
      case "bin":
        return this.evalBinary(e, scope);
      case "tern":
        return truthy(this.eval(e.c, scope)) ? this.eval(e.a, scope) : this.eval(e.b, scope);
      case "ifx": {
        const value = this.exec(e.stmt as IfStmt, scope);
        return value === undefined ? NaN : value;
      }
      case "member": {
        const name = this.dotted(e);
        if (name) {
          const v = dottedVariable(this.ctx, name);
          if (v !== undefined) return v;
        }
        throw new PineError(e.line, "Unknown identifier '" + (name ?? e.prop) + "'");
      }
      case "index":
        return this.evalIndex(e, scope);
      case "call":
        return this.evalCall(e, scope);
    }
  }

  private evalId(name: string, line: number, scope: Scope): V {
    const owner = scope.owner(name);
    if (owner) return owner.vars.get(name) as V;
    if (isSeriesName(name)) return seriesValue(this.ctx, name, this.ctx.bar);
    if (name === "na") return NaN;
    if (name === "last_bar_index") return this.ctx.candles.length - 1;
    const v = dottedVariable(this.ctx, name);
    if (v !== undefined) return v;
    throw new PineError(line, "Unknown identifier '" + name + "'");
  }

  private evalBinary(e: Extract<Expr, { k: "bin" }>, scope: Scope): V {
    if (e.op === "and") return truthy(this.eval(e.l, scope)) && truthy(this.eval(e.r, scope));
    if (e.op === "or") return truthy(this.eval(e.l, scope)) || truthy(this.eval(e.r, scope));

    const l = this.eval(e.l, scope);
    const r = this.eval(e.r, scope);

    if (e.op === "+" && (typeof l === "string" || typeof r === "string")) {
      return String(typeof l === "number" && Number.isNaN(l) ? "NaN" : l) + String(r);
    }
    if (e.op === "==" || e.op === "!=") {
      const equal = typeof l === "string" || typeof r === "string" ? l === r : num(l) === num(r);
      return e.op === "==" ? equal : !equal;
    }

    const a = num(l);
    const b = num(r);
    switch (e.op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return a / b;
      case "%": return a % b;
      case "<": return a < b;
      case ">": return a > b;
      case "<=": return a <= b;
      case ">=": return a >= b;
      default:
        throw new PineError(e.line, "Unsupported operator '" + e.op + "'");
    }
  }

  private evalIndex(e: Extract<Expr, { k: "index" }>, scope: Scope): V {
    const offsetValue = num(this.eval(e.idx, scope));
    if (Number.isNaN(offsetValue) || offsetValue < 0) {
      throw new PineError(e.line, "History offset must be a non-negative number");
    }
    const offset = Math.floor(offsetValue);
    const bar = this.ctx.bar;

    if (e.obj.k === "id") {
      const name = e.obj.name;
      const owner = scope.owner(name);
      if (owner === this.global) {
        if (offset === 0) return owner.vars.get(name) as V;
        const h = this.history.get(name);
        const v = h ? h[bar - offset] : undefined;
        return v === undefined ? NaN : v;
      }
      if (!owner && isSeriesName(name)) return seriesValue(this.ctx, name, bar - offset);
    }

    // Generic case: remember this expression's value on every bar.
    const st = this.stateOf(e);
    const value = this.eval(e.obj, scope);
    const h = (st.h ??= []) as V[];
    h[bar] = value;
    if (offset === 0) return value;
    const past = h[bar - offset];
    return past === undefined ? NaN : past;
  }

  private evalCall(e: Extract<Expr, { k: "call" }>, scope: Scope): V {
    const name = this.dotted(e.callee);
    if (!name) throw new PineError(e.line, "This expression cannot be called");

    const positional: V[] = [];
    const named: Record<string, V> = {};
    for (const arg of e.args as Arg[]) {
      const value = this.eval(arg.value, scope);
      if (arg.name) named[arg.name] = value;
      else positional.push(value);
    }

    const user = this.funcs.get(name);
    if (user) return this.callUser(name, user, positional, named, e.line);

    const builtin = findBuiltin(name);
    if (!builtin) throw new PineError(e.line, "Unsupported function '" + name + "'");

    const args: Args = {};
    positional.forEach((v, i) => {
      if (i < builtin.params.length) args[builtin.params[i]] = v;
    });
    for (const [k, v] of Object.entries(named)) args[k] = v;
    return builtin.f(args, this.ctx, this.stateOf(e), e.line);
  }

  private callUser(
    name: string, fn: UserFunc, positional: V[], named: Record<string, V>, line: number
  ): V {
    const local = new Scope(this.global);
    fn.params.forEach((p, i) => {
      let value: V | undefined = i < positional.length ? positional[i] : named[p.name];
      if (value === undefined && p.def) value = this.eval(p.def, local);
      if (value === undefined) throw new PineError(line, "Missing argument '" + p.name + "' in call to " + name + "()");
      local.vars.set(p.name, value);
    });
    const result = this.execBlock(fn.body, local, false);
    return result === undefined ? NaN : result;
  }
}

export function runPine(
  source: string,
  candles: MarketCandle[],
  options: { symbol?: string; timeframe?: string } = {}
): PineResult {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const result: PineResult = {
    title: "Pine script",
    overlay: false,
    plots: [],
    hlines: [],
    errors: [],
    warnings: [],
    runtimeMs: 0,
  };

  try {
    const program = parse(source);
    const interpreter = new Interpreter(candles, options.symbol ?? "", options.timeframe ?? "");
    interpreter.run(program);
    const ctx = interpreter.ctx;

    result.title = ctx.meta.title;
    result.overlay = ctx.meta.overlay;
    result.warnings = ctx.warnings;
    result.hlines = [...ctx.hlines.values()];
    result.plots = [...ctx.plots.values()].map((p) => ({
      title: p.title,
      color: p.color,
      lineWidth: p.lineWidth,
      style: p.style,
      points: candles.map((candle, i) => p.points[i] ?? { time: Math.floor(candle.openTime / 1000) }),
    }));
    if (result.plots.length === 0 && result.hlines.length === 0) {
      result.warnings.push({ line: 0, message: "The script ran but did not call plot() or hline(), so nothing is drawn." });
    }
  } catch (error) {
    if (error instanceof PineError) {
      result.errors.push({ line: error.line, message: error.message });
    } else if (error instanceof BreakSignal || error instanceof ContinueSignal) {
      result.errors.push({ line: 0, message: "'break' / 'continue' can only be used inside a loop" });
    } else {
      result.errors.push({
        line: 0,
        message: "Internal error: " + (error instanceof Error ? error.message : String(error)),
      });
    }
  }

  const finished = typeof performance !== "undefined" ? performance.now() : Date.now();
  result.runtimeMs = Math.round(finished - started);
  return result;
}
