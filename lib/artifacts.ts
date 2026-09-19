/**
 * Artifacts are small visual components the tutor can generate alongside an
 * answer. The model emits loose JSON; `normalizeArtifact` turns it into one of
 * these strict shapes (or null) before it reaches the renderer.
 */

export type CodeArtifact = {
  type: "code";
  title: string;
  language: string;
  code: string;
  caption?: string;
};

export type GraphArtifact = {
  type: "graph";
  title: string;
  functions: Array<{ expression: string; label: string }>;
  xMin: number;
  xMax: number;
  caption?: string;
};

export type ChartArtifact = {
  type: "chart";
  title: string;
  kind: "bar" | "line";
  unit?: string;
  data: Array<{ label: string; value: number }>;
  caption?: string;
};

export type ChecklistArtifact = {
  type: "checklist";
  title: string;
  items: Array<{ text: string; detail?: string }>;
  caption?: string;
};

export type StepsArtifact = {
  type: "steps";
  title: string;
  steps: Array<{ title: string; detail: string }>;
  caption?: string;
};

export type TableArtifact = {
  type: "table";
  title: string;
  columns: string[];
  rows: string[][];
  caption?: string;
};

export type FlashcardsArtifact = {
  type: "flashcards";
  title: string;
  cards: Array<{ front: string; back: string }>;
  caption?: string;
};

export type MockupField = {
  label: string;
  value?: string;
  placeholder?: string;
  kind?: "text" | "number" | "select" | "toggle";
  options?: string[];
};

export type MockupArtifact = {
  type: "mockup";
  title: string;
  screen: {
    heading: string;
    subheading?: string;
    fields: MockupField[];
    actions: string[];
    note?: string;
  };
  caption?: string;
};

export type CalculatorArtifact = {
  type: "calculator";
  title: string;
  inputs: Array<{
    id: string;
    label: string;
    default: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
  }>;
  outputs: Array<{ label: string; expression: string; unit?: string }>;
  caption?: string;
};

export type Artifact =
  | CodeArtifact
  | GraphArtifact
  | ChartArtifact
  | ChecklistArtifact
  | StepsArtifact
  | TableArtifact
  | FlashcardsArtifact
  | MockupArtifact
  | CalculatorArtifact;

export const ARTIFACT_TYPES = [
  "code",
  "graph",
  "chart",
  "checklist",
  "steps",
  "table",
  "flashcards",
  "mockup",
  "calculator",
] as const;

type Raw = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const optStr = (v: unknown): string | undefined => {
  const s = str(v).trim();
  return s ? s : undefined;
};

/** Convert loosely structured model output into a strict Artifact, or null. */
export function normalizeArtifact(input: unknown): Artifact | null {
  const raw = obj(input);
  const type = str(raw.type).toLowerCase().trim();
  const title = str(raw.title, "").trim() || "Artifact";
  const caption = optStr(raw.caption);

  switch (type) {
    case "code": {
      const code = str(raw.code).replace(/\r\n/g, "\n");
      if (!code.trim()) return null;
      return {
        type,
        title,
        language: str(raw.language, "text").toLowerCase() || "text",
        code: code.slice(0, 6000),
        caption,
      };
    }
    case "graph": {
      const functions = arr(raw.functions)
        .map((f) => {
          const o = typeof f === "string" ? { expression: f } : obj(f);
          const expression = str(o.expression ?? o.expr ?? o.fn).trim();
          return expression ? { expression, label: str(o.label, expression) } : null;
        })
        .filter((f): f is { expression: string; label: string } => f !== null)
        .slice(0, 4);
      if (functions.length === 0) return null;
      let xMin = num(raw.xMin, -10);
      let xMax = num(raw.xMax, 10);
      if (xMin >= xMax) [xMin, xMax] = [Math.min(xMin, xMax) - 5, Math.max(xMin, xMax) + 5];
      return { type, title, functions, xMin, xMax, caption };
    }
    case "chart": {
      const data = arr(raw.data)
        .map((d) => {
          const o = obj(d);
          const label = str(o.label ?? o.name).trim();
          const value = num(o.value, Number.NaN);
          return label && Number.isFinite(value) ? { label, value } : null;
        })
        .filter((d): d is { label: string; value: number } => d !== null)
        .slice(0, 16);
      if (data.length === 0) return null;
      return {
        type,
        title,
        kind: str(raw.kind) === "line" ? "line" : "bar",
        unit: optStr(raw.unit),
        data,
        caption,
      };
    }
    case "checklist": {
      const items = arr(raw.items)
        .map((it) => {
          const o = typeof it === "string" ? { text: it } : obj(it);
          const text = str(o.text ?? o.label ?? o.title).trim();
          return text ? { text, detail: optStr(o.detail ?? o.description) } : null;
        })
        .filter((it): it is { text: string; detail: string | undefined } => it !== null)
        .slice(0, 20);
      if (items.length === 0) return null;
      return { type, title, items, caption };
    }
    case "steps":
    case "timeline": {
      const steps = arr(raw.steps ?? raw.items)
        .map((s) => {
          const o = typeof s === "string" ? { title: s } : obj(s);
          const stepTitle = str(o.title ?? o.label ?? o.text).trim();
          return stepTitle ? { title: stepTitle, detail: str(o.detail ?? o.description ?? o.body) } : null;
        })
        .filter((s): s is { title: string; detail: string } => s !== null)
        .slice(0, 12);
      if (steps.length === 0) return null;
      return { type: "steps", title, steps, caption };
    }
    case "table": {
      const columns = arr(raw.columns ?? raw.headers).map((c) => str(c)).filter(Boolean).slice(0, 6);
      const rows = arr(raw.rows)
        .map((r) => arr(r).map((c) => (typeof c === "number" ? String(c) : str(c))))
        .filter((r) => r.length > 0)
        .slice(0, 20);
      if (columns.length === 0 || rows.length === 0) return null;
      return { type, title, columns, rows, caption };
    }
    case "flashcards": {
      const cards = arr(raw.cards)
        .map((c) => {
          const o = obj(c);
          const front = str(o.front ?? o.term ?? o.question).trim();
          const back = str(o.back ?? o.definition ?? o.answer).trim();
          return front && back ? { front, back } : null;
        })
        .filter((c): c is { front: string; back: string } => c !== null)
        .slice(0, 16);
      if (cards.length === 0) return null;
      return { type, title, cards, caption };
    }
    case "mockup":
    case "ui": {
      const screen = obj(raw.screen ?? raw);
      const fields: MockupField[] = [];
      for (const f of arr(screen.fields)) {
        const o = obj(f);
        const label = str(o.label).trim();
        if (!label) continue;
        const kindRaw = str(o.kind ?? o.type);
        const kind: MockupField["kind"] =
          kindRaw === "number" || kindRaw === "select" || kindRaw === "toggle" ? kindRaw : "text";
        fields.push({
          label,
          value: optStr(o.value),
          placeholder: optStr(o.placeholder),
          kind,
          options: arr(o.options).map((x) => str(x)).filter(Boolean).slice(0, 6),
        });
        if (fields.length >= 8) break;
      }
      const actions = arr(screen.actions ?? screen.buttons).map((a) => str(a)).filter(Boolean).slice(0, 3);
      const heading = str(screen.heading ?? screen.title, title).trim();
      if (!heading) return null;
      return {
        type: "mockup",
        title,
        screen: {
          heading,
          subheading: optStr(screen.subheading),
          fields,
          actions: actions.length ? actions : ["Continue"],
          note: optStr(screen.note),
        },
        caption,
      };
    }
    case "calculator": {
      const inputs = arr(raw.inputs)
        .map((i, index) => {
          const o = obj(i);
          const id = str(o.id, `x${index + 1}`).replace(/[^a-zA-Z0-9_]/g, "_") || `x${index + 1}`;
          const label = str(o.label, id).trim();
          return {
            id,
            label,
            default: num(o.default ?? o.value, 0),
            min: typeof o.min === "number" ? o.min : undefined,
            max: typeof o.max === "number" ? o.max : undefined,
            step: typeof o.step === "number" && o.step > 0 ? o.step : undefined,
            unit: optStr(o.unit),
          };
        })
        .slice(0, 6);
      const outputs = arr(raw.outputs)
        .map((o) => {
          const r = obj(o);
          const expression = str(r.expression ?? r.formula).trim();
          const label = str(r.label, "Result").trim();
          return expression ? { label, expression, unit: optStr(r.unit) } : null;
        })
        .filter((o): o is { label: string; expression: string; unit: string | undefined } => o !== null)
        .slice(0, 4);
      if (inputs.length === 0 || outputs.length === 0) return null;
      return { type, title, inputs, outputs, caption };
    }
    default:
      return null;
  }
}

/** Human friendly label for a tab or history chip. */
export function artifactLabel(a: Artifact): string {
  const names: Record<Artifact["type"], string> = {
    code: "Code",
    graph: "Graph",
    chart: "Chart",
    checklist: "Checklist",
    steps: "Steps",
    table: "Table",
    flashcards: "Flashcards",
    mockup: "Screen",
    calculator: "Calculator",
  };
  return names[a.type];
}
