import { lex, type Token } from "./lexer";
import { PineError } from "./types";

export type Arg = { name?: string; value: Expr };

export type Expr =
  | { k: "num"; v: number; line: number }
  | { k: "str"; v: string; line: number }
  | { k: "bool"; v: boolean; line: number }
  | { k: "id"; name: string; line: number }
  | { k: "array"; items: Expr[]; line: number }
  | { k: "index"; obj: Expr; idx: Expr; line: number }
  | { k: "member"; obj: Expr; prop: string; line: number }
  | { k: "call"; callee: Expr; args: Arg[]; line: number }
  | { k: "unary"; op: string; e: Expr; line: number }
  | { k: "bin"; op: string; l: Expr; r: Expr; line: number }
  | { k: "tern"; c: Expr; a: Expr; b: Expr; line: number }
  | { k: "ifx"; stmt: IfStmt; line: number };

export type Param = { name: string; def?: Expr };

export type IfStmt = { k: "if"; cond: Expr; then: Stmt[]; else: Stmt[]; line: number };

export type Stmt =
  | { k: "decl"; names: string[]; init: Expr; isVar: boolean; line: number }
  | { k: "assign"; name: string; value: Expr; line: number }
  | IfStmt
  | { k: "for"; v: string; from: Expr; to: Expr; by?: Expr; body: Stmt[]; line: number }
  | { k: "while"; cond: Expr; body: Stmt[]; line: number }
  | { k: "func"; name: string; params: Param[]; body: Stmt[]; line: number }
  | { k: "expr"; e: Expr; line: number }
  | { k: "break"; line: number }
  | { k: "continue"; line: number };

const TYPE_WORDS = new Set(["int", "float", "bool", "string", "color", "series", "simple", "const"]);
const ASSIGN_OPS = new Set(["=", ":=", "+=", "-=", "*=", "/=", "%="]);

class Parser {
  private pos = 0;
  constructor(private toks: Token[]) {}

  private peek(o = 0): Token {
    return this.toks[Math.min(this.pos + o, this.toks.length - 1)];
  }
  private next(): Token {
    const t = this.peek();
    if (this.pos < this.toks.length - 1) this.pos += 1;
    return t;
  }
  private isOp(v: string, o = 0): boolean {
    const t = this.peek(o);
    return t.k === "op" && t.v === v;
  }
  private isWord(v: string, o = 0): boolean {
    const t = this.peek(o);
    return t.k === "id" && t.v === v;
  }
  private expectOp(v: string): Token {
    const t = this.peek();
    if (t.k !== "op" || t.v !== v) {
      throw new PineError(t.line, "Expected '" + v + "' but found " + this.describe(t));
    }
    return this.next();
  }
  private describe(t: Token): string {
    if (t.k === "nl") return "end of line";
    if (t.k === "eof") return "end of script";
    if (t.k === "indent") return "unexpected indentation";
    if (t.k === "dedent") return "end of block";
    return "'" + t.v + "'";
  }
  private skipNewlines() {
    while (this.peek().k === "nl") this.next();
  }
  private endStatement() {
    const t = this.peek();
    if (t.k === "nl") {
      this.next();
      return;
    }
    if (t.k === "eof" || t.k === "dedent") return;
    // `x = if cond ... else ...` ends with the dedent of its last block.
    if (this.pos > 0 && this.toks[this.pos - 1].k === "dedent") return;
    throw new PineError(t.line, "Unexpected " + this.describe(t));
  }

  parseProgram(): Stmt[] {
    const out: Stmt[] = [];
    this.skipNewlines();
    while (this.peek().k !== "eof") {
      if (this.peek().k === "indent") throw new PineError(this.peek().line, "Unexpected indentation");
      out.push(this.parseStatement());
      this.skipNewlines();
    }
    return out;
  }

  private parseBlock(): Stmt[] {
    this.skipNewlines();
    const t = this.peek();
    if (t.k !== "indent") throw new PineError(t.line, "Expected an indented block");
    this.next();
    const body: Stmt[] = [];
    this.skipNewlines();
    while (this.peek().k !== "dedent" && this.peek().k !== "eof") {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    if (this.peek().k === "dedent") this.next();
    return body;
  }

  private parseIf(): IfStmt {
    const line = this.next().line; // 'if'
    const cond = this.parseExpr();
    const then = this.parseBlock();
    let otherwise: Stmt[] = [];
    this.skipNewlinesBeforeElse();
    if (this.isWord("else")) {
      this.next();
      if (this.isWord("if")) otherwise = [this.parseIf()];
      else otherwise = this.parseBlock();
    }
    return { k: "if", cond, then, else: otherwise, line };
  }

  private skipNewlinesBeforeElse() {
    let o = 0;
    while (this.peek(o).k === "nl") o += 1;
    if (this.peek(o).k === "id" && this.peek(o).v === "else") this.pos += o;
  }

  private looksLikeFunctionDef(): boolean {
    if (this.peek().k !== "id" || !this.isOp("(", 1)) return false;
    let depth = 0;
    let o = 1;
    for (;; o += 1) {
      const t = this.peek(o);
      if (t.k === "eof" || t.k === "nl") return false;
      if (t.k === "op" && t.v === "(") depth += 1;
      if (t.k === "op" && t.v === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    return this.isOp("=>", o + 1);
  }

  private parseFunctionDef(): Stmt {
    const nameTok = this.next();
    this.expectOp("(");
    const params: Param[] = [];
    while (!this.isOp(")")) {
      let t = this.next();
      if (t.k === "id" && TYPE_WORDS.has(t.v) && this.peek().k === "id") t = this.next();
      if (t.k !== "id") throw new PineError(t.line, "Expected a parameter name");
      const param: Param = { name: t.v };
      if (this.isOp("=")) {
        this.next();
        param.def = this.parseExpr();
      }
      params.push(param);
      if (this.isOp(",")) this.next();
      else break;
    }
    this.expectOp(")");
    this.expectOp("=>");
    let body: Stmt[];
    if (this.peek().k === "nl") body = this.parseBlock();
    else {
      const e = this.parseExpr();
      body = [{ k: "expr", e, line: nameTok.line }];
      this.endStatement();
    }
    return { k: "func", name: nameTok.v, params, body, line: nameTok.line };
  }

  private parseStatement(): Stmt {
    this.skipNewlines();
    const t = this.peek();

    if (t.k === "id") {
      switch (t.v) {
        case "if":
          return this.parseIf();
        case "for":
          return this.parseFor();
        case "while": {
          this.next();
          const cond = this.parseExpr();
          const body = this.parseBlock();
          return { k: "while", cond, body, line: t.line };
        }
        case "break":
          this.next();
          this.endStatement();
          return { k: "break", line: t.line };
        case "continue":
          this.next();
          this.endStatement();
          return { k: "continue", line: t.line };
        case "var":
        case "varip": {
          this.next();
          if (this.peek().k === "id" && TYPE_WORDS.has(this.peek().v) &&
              this.peek(1).k === "id" && this.isOp("=", 2)) this.next();
          const name = this.next();
          if (name.k !== "id") throw new PineError(name.line, "Expected a variable name after 'var'");
          this.expectOp("=");
          const init = this.parseExpr();
          this.endStatement();
          return { k: "decl", names: [name.v], init, isVar: true, line: t.line };
        }
        case "switch":
        case "import":
        case "export":
        case "type":
        case "method":
          throw new PineError(t.line, "'" + t.v + "' is not supported yet");
        default:
          break;
      }
      if (this.looksLikeFunctionDef()) return this.parseFunctionDef();

      // Typed declaration: float x = ...
      if (TYPE_WORDS.has(t.v) && this.peek(1).k === "id" &&
          (this.isOp("=", 2) || this.isOp(":=", 2))) {
        this.next();
        return this.parseStatement();
      }

      // x = ...,  x := ...,  x += ...
      if (this.peek(1).k === "op" && ASSIGN_OPS.has(this.peek(1).v)) {
        const name = this.next();
        const op = this.next().v;
        const rhs = this.parseExpr();
        this.endStatement();
        if (op === "=") return { k: "decl", names: [name.v], init: rhs, isVar: false, line: name.line };
        const value: Expr = op === ":="
          ? rhs
          : { k: "bin", op: op[0], l: { k: "id", name: name.v, line: name.line }, r: rhs, line: name.line };
        return { k: "assign", name: name.v, value, line: name.line };
      }
    }

    // [a, b] = expr
    if (t.k === "op" && t.v === "[") {
      let o = 1;
      let ok = true;
      const names: string[] = [];
      for (;;) {
        const n = this.peek(o);
        if (n.k !== "id") { ok = false; break; }
        names.push(n.v);
        o += 1;
        if (this.isOp(",", o)) { o += 1; continue; }
        if (this.isOp("]", o)) { o += 1; break; }
        ok = false;
        break;
      }
      if (ok && this.isOp("=", o)) {
        this.pos += o + 1;
        const init = this.parseExpr();
        this.endStatement();
        return { k: "decl", names, init, isVar: false, line: t.line };
      }
    }

    const e = this.parseExpr();
    this.endStatement();
    return { k: "expr", e, line: t.line };
  }

  private parseFor(): Stmt {
    const line = this.next().line; // 'for'
    const v = this.next();
    if (v.k !== "id") throw new PineError(v.line, "Expected a loop variable");
    this.expectOp("=");
    const from = this.parseExpr();
    if (!this.isWord("to")) throw new PineError(this.peek().line, "Expected 'to' in for loop");
    this.next();
    const to = this.parseExpr();
    let by: Expr | undefined;
    if (this.isWord("by")) {
      this.next();
      by = this.parseExpr();
    }
    const body = this.parseBlock();
    return { k: "for", v: v.v, from, to, by, body, line };
  }

  // ----- expressions -----

  parseExpr(): Expr {
    const c = this.parseOr();
    if (this.isOp("?")) {
      const line = this.next().line;
      const a = this.parseExpr();
      this.expectOp(":");
      const b = this.parseExpr();
      return { k: "tern", c, a, b, line };
    }
    return c;
  }

  private parseOr(): Expr {
    let l = this.parseAnd();
    while (this.isWord("or")) {
      const line = this.next().line;
      l = { k: "bin", op: "or", l, r: this.parseAnd(), line };
    }
    return l;
  }

  private parseAnd(): Expr {
    let l = this.parseNot();
    while (this.isWord("and")) {
      const line = this.next().line;
      l = { k: "bin", op: "and", l, r: this.parseNot(), line };
    }
    return l;
  }

  private parseNot(): Expr {
    if (this.isWord("not")) {
      const line = this.next().line;
      return { k: "unary", op: "not", e: this.parseNot(), line };
    }
    return this.parseCompare();
  }

  private parseCompare(): Expr {
    let l = this.parseAdd();
    for (;;) {
      const t = this.peek();
      if (t.k === "op" && ["==", "!=", "<", ">", "<=", ">="].includes(t.v)) {
        this.next();
        l = { k: "bin", op: t.v, l, r: this.parseAdd(), line: t.line };
      } else return l;
    }
  }

  private parseAdd(): Expr {
    let l = this.parseMul();
    for (;;) {
      const t = this.peek();
      if (t.k === "op" && (t.v === "+" || t.v === "-")) {
        this.next();
        l = { k: "bin", op: t.v, l, r: this.parseMul(), line: t.line };
      } else return l;
    }
  }

  private parseMul(): Expr {
    let l = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t.k === "op" && (t.v === "*" || t.v === "/" || t.v === "%")) {
        this.next();
        l = { k: "bin", op: t.v, l, r: this.parseUnary(), line: t.line };
      } else return l;
    }
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.k === "op" && (t.v === "-" || t.v === "+")) {
      this.next();
      return { k: "unary", op: t.v, e: this.parseUnary(), line: t.line };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.k === "op" && t.v === "(" && (e.k === "id" || e.k === "member")) {
        this.next();
        const args: Arg[] = [];
        while (!this.isOp(")")) {
          if (this.peek().k === "nl") this.next();
          if (this.peek().k === "id" && this.isOp("=", 1)) {
            const name = this.next().v;
            this.next();
            args.push({ name, value: this.parseExpr() });
          } else {
            args.push({ value: this.parseExpr() });
          }
          if (this.isOp(",")) this.next();
          else break;
        }
        this.expectOp(")");
        e = { k: "call", callee: e, args, line: t.line };
      } else if (t.k === "op" && t.v === "[") {
        this.next();
        const idx = this.parseExpr();
        this.expectOp("]");
        e = { k: "index", obj: e, idx, line: t.line };
      } else if (t.k === "op" && t.v === ".") {
        this.next();
        const p = this.next();
        if (p.k !== "id") throw new PineError(p.line, "Expected a name after '.'");
        e = { k: "member", obj: e, prop: p.v, line: p.line };
      } else return e;
    }
  }

  private parsePrimary(): Expr {
    const t = this.next();
    switch (t.k) {
      case "num":
        return { k: "num", v: Number(t.v), line: t.line };
      case "str":
      case "color":
        return { k: "str", v: t.v, line: t.line };
      case "id":
        if (t.v === "true") return { k: "bool", v: true, line: t.line };
        if (t.v === "false") return { k: "bool", v: false, line: t.line };
        if (t.v === "if") {
          this.pos -= 1;
          const stmt = this.parseIf();
          return { k: "ifx", stmt, line: t.line };
        }
        return { k: "id", name: t.v, line: t.line };
      case "op":
        if (t.v === "(") {
          const e = this.parseExpr();
          this.expectOp(")");
          return e;
        }
        if (t.v === "[") {
          const items: Expr[] = [];
          while (!this.isOp("]")) {
            items.push(this.parseExpr());
            if (this.isOp(",")) this.next();
            else break;
          }
          this.expectOp("]");
          return { k: "array", items, line: t.line };
        }
        break;
      default:
        break;
    }
    throw new PineError(t.line, "Unexpected " + this.describe(t));
  }
}

export function parse(source: string): Stmt[] {
  return new Parser(lex(source)).parseProgram();
}
