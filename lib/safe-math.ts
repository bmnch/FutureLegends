/**
 * Tiny, dependency free math expression evaluator.
 *
 * Supports: numbers, + - * / % ^, parentheses, unary minus, named variables,
 * and a whitelist of functions/constants. Anything else throws, so model
 * generated expressions can never reach `eval`.
 */

type Token =
  | { kind: "num"; value: number }
  | { kind: "id"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j += 1;
      if (j < src.length && /[eE]/.test(src[j]!) && /[0-9+-]/.test(src[j + 1] ?? "")) {
        j += 2;
        while (j < src.length && /[0-9]/.test(src[j]!)) j += 1;
      }
      const value = Number(src.slice(i, j));
      if (!Number.isFinite(value)) throw new Error(`Bad number near "${src.slice(i, j)}"`);
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j += 1;
      tokens.push({ kind: "id", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/%^".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return tokens;
}

type Node =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "call"; name: string; args: Node[] };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): Node {
    const node = this.additive();
    if (this.pos < this.tokens.length) throw new Error("Unexpected trailing input");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const tok = this.tokens[this.pos];
    if (!tok) throw new Error("Unexpected end of expression");
    this.pos += 1;
    return tok;
  }

  private isOp(value: string): boolean {
    const tok = this.peek();
    return tok?.kind === "op" && tok.value === value;
  }

  private additive(): Node {
    let node = this.multiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.next() as { value: string }).value;
      node = { t: "bin", op, a: node, b: this.multiplicative() };
    }
    return node;
  }

  private multiplicative(): Node {
    let node = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = (this.next() as { value: string }).value;
      node = { t: "bin", op, a: node, b: this.unary() };
    }
    return node;
  }

  private unary(): Node {
    if (this.isOp("-")) {
      this.next();
      return { t: "neg", a: this.unary() };
    }
    if (this.isOp("+")) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.primary();
    if (this.isOp("^")) {
      this.next();
      // Right associative: 2^3^2 = 2^(3^2)
      return { t: "bin", op: "^", a: base, b: this.unary() };
    }
    return base;
  }

  private primary(): Node {
    const tok = this.next();
    if (tok.kind === "num") return { t: "num", v: tok.value };
    if (tok.kind === "lparen") {
      const inner = this.additive();
      const close = this.next();
      if (close.kind !== "rparen") throw new Error("Missing closing parenthesis");
      return inner;
    }
    if (tok.kind === "id") {
      if (this.peek()?.kind === "lparen") {
        this.next();
        const args: Node[] = [];
        if (this.peek()?.kind !== "rparen") {
          args.push(this.additive());
          while (this.peek()?.kind === "comma") {
            this.next();
            args.push(this.additive());
          }
        }
        const close = this.next();
        if (close.kind !== "rparen") throw new Error("Missing closing parenthesis");
        return { t: "call", name: tok.value.toLowerCase(), args };
      }
      return { t: "var", name: tok.value };
    }
    throw new Error("Unexpected token");
  }
}

function evaluate(node: Node, vars: Record<string, number>): number {
  switch (node.t) {
    case "num":
      return node.v;
    case "var": {
      if (node.name in vars) return vars[node.name]!;
      const lower = node.name.toLowerCase();
      if (lower in CONSTANTS) return CONSTANTS[lower]!;
      throw new Error(`Unknown variable "${node.name}"`);
    }
    case "neg":
      return -evaluate(node.a, vars);
    case "bin": {
      const a = evaluate(node.a, vars);
      const b = evaluate(node.b, vars);
      switch (node.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return a / b;
        case "%":
          return a % b;
        case "^":
          return Math.pow(a, b);
        default:
          throw new Error(`Unknown operator ${node.op}`);
      }
    }
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new Error(`Unknown function "${node.name}"`);
      return fn(...node.args.map((arg) => evaluate(arg, vars)));
    }
    default:
      throw new Error("Bad expression");
  }
}

export type CompiledExpression = {
  source: string;
  eval: (vars?: Record<string, number>) => number;
};

/** Parse once, evaluate many times. Throws on invalid syntax. */
export function compileExpression(source: string): CompiledExpression {
  const cleaned = source
    .replace(/\s+/g, " ")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\*\*/g, "^")
    .trim();
  if (cleaned.length === 0) throw new Error("Empty expression");
  if (cleaned.length > 400) throw new Error("Expression too long");
  const ast = new Parser(tokenize(cleaned)).parse();
  return {
    source: cleaned,
    eval: (vars = {}) => evaluate(ast, vars),
  };
}

/** Convenience: returns NaN instead of throwing. */
export function tryEvaluate(source: string, vars: Record<string, number> = {}): number {
  try {
    return compileExpression(source).eval(vars);
  } catch {
    return Number.NaN;
  }
}
