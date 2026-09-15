export type Question = {
  prompt: string;
  answer: number;
};

export type GradeBand = "4-5" | "6-7" | "8-9" | "10-12";

export type QuestionKind =
  | "plain-add"
  | "plain-sub"
  | "plain-mul"
  | "plain-div"
  | "eval-one"
  | "solve-one"
  | "eval-two"
  | "solve-two";

export type DifficultyTier = "add-sub" | "mul-div" | "plain" | "eval" | "solve";

export const GRADE_BANDS: { id: GradeBand; label: string }[] = [
  { id: "4-5", label: "4–5" },
  { id: "6-7", label: "6–7" },
  { id: "8-9", label: "8–9" },
  { id: "10-12", label: "10–12" },
];

/** True when a band can produce negative answers (needs the ± key). */
export const bandAllowsNegative = (band: GradeBand) => band !== "4-5";

const MINUS = "−";
const TIMES = "×";
const DIV = "÷";

const PLAIN_KINDS: QuestionKind[] = ["plain-add", "plain-sub", "plain-mul", "plain-div"];
const ADD_SUB_KINDS: QuestionKind[] = ["plain-add", "plain-sub"];
const MUL_DIV_KINDS: QuestionKind[] = ["plain-mul", "plain-div"];

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(items: readonly T[]): T => items[rand(0, items.length - 1)]!;

/** Format a number for prompts; use Unicode minus for negatives. */
const fmt = (n: number): string => (n < 0 ? `${MINUS}${Math.abs(n)}` : `${n}`);

/** Operand form: wrap negatives in parentheses for × and ÷ clarity. */
const fmtOp = (n: number, parenIfNeg = false): string => {
  if (parenIfNeg && n < 0) return `(${fmt(n)})`;
  return fmt(n);
};

const signedMag = (maxMag: number, allowZero = true): number => {
  const mag = allowZero ? rand(0, maxMag) : rand(1, maxMag);
  if (mag === 0) return 0;
  return Math.random() < 0.5 ? mag : -mag;
};

const varName = (): "x" | "y" => (Math.random() < 0.5 ? "x" : "y");

/** Exact division with |dividend| and |divisor| both ≤ max. */
function exactDivUnsigned(max: number): Question {
  const divisor = rand(1, max);
  const maxQuotient = Math.max(1, Math.floor(max / divisor));
  const quotient = rand(1, maxQuotient);
  const dividend = divisor * quotient;
  return { prompt: `${dividend} ${DIV} ${divisor}`, answer: quotient };
}

function exactDivSigned(max: number): Question {
  const divisorMag = rand(1, max);
  const maxQuotient = Math.max(1, Math.floor(max / divisorMag));
  const quotientMag = rand(1, maxQuotient);
  const divisor = Math.random() < 0.5 ? divisorMag : -divisorMag;
  const quotient = Math.random() < 0.5 ? quotientMag : -quotientMag;
  const dividend = divisor * quotient;
  return {
    prompt: `${fmtOp(dividend, true)} ${DIV} ${fmtOp(divisor, true)}`,
    answer: quotient,
  };
}

function plainUnsigned(max: number, kind: QuestionKind): Question {
  if (kind === "plain-add") {
    const a = rand(0, max);
    const b = rand(0, max);
    return { prompt: `${a} + ${b}`, answer: a + b };
  }
  if (kind === "plain-sub") {
    let a = rand(0, max);
    let b = rand(0, max);
    if (b > a) [a, b] = [b, a];
    return { prompt: `${a} ${MINUS} ${b}`, answer: a - b };
  }
  if (kind === "plain-mul") {
    const a = rand(0, max);
    const b = rand(0, max);
    return { prompt: `${a} ${TIMES} ${b}`, answer: a * b };
  }
  return exactDivUnsigned(max);
}

function plainSigned(max: number, kind: QuestionKind): Question {
  if (kind === "plain-add") {
    const a = signedMag(max);
    const b = signedMag(max);
    return { prompt: `${fmt(a)} + ${fmtOp(b, true)}`, answer: a + b };
  }
  if (kind === "plain-sub") {
    const a = signedMag(max);
    const b = signedMag(max);
    return { prompt: `${fmt(a)} ${MINUS} ${fmtOp(b, true)}`, answer: a - b };
  }
  if (kind === "plain-mul") {
    const a = signedMag(max);
    const b = signedMag(max);
    return {
      prompt: `${fmtOp(a, true)} ${TIMES} ${fmtOp(b, true)}`,
      answer: a * b,
    };
  }
  return exactDivSigned(max);
}

/** One-step evaluate: given v = n, compute a simple expression. */
function evaluateOneStep(max: number): Question {
  const v = varName();
  const value = signedMag(max, false);
  const kind = rand(0, 3);
  if (kind === 0) {
    const k = rand(2, 9);
    const b = signedMag(Math.min(max, 40));
    const answer = k * value + b;
    let term = `${k}${v}`;
    if (b > 0) term = `${term} + ${b}`;
    else if (b < 0) term = `${term} ${MINUS} ${Math.abs(b)}`;
    return { prompt: `${v} = ${fmt(value)}, ${term}`, answer };
  }
  if (kind === 1) {
    const b = signedMag(max);
    return {
      prompt: `${v} = ${fmt(value)}, ${v} ${MINUS} ${fmtOp(b, true)}`,
      answer: value - b,
    };
  }
  if (kind === 2) {
    const k = rand(2, 12);
    return {
      prompt: `${v} = ${fmt(value)}, ${k} ${TIMES} ${v}`,
      answer: k * value,
    };
  }
  // Exact division: value must be divisible by k — build from quotient
  const k = rand(2, 12);
  const quotient = signedMag(Math.min(max, 20), false);
  const val = k * quotient;
  return {
    prompt: `${v} = ${fmt(val)}, ${v} ${DIV} ${k}`,
    answer: quotient,
  };
}

/** One-step solve for x/y. */
function solveOneStep(max: number): Question {
  const v = varName();
  const solution = signedMag(max, false);
  const kind = rand(0, 3);
  if (kind === 0) {
    const a = signedMag(max);
    const rhs = solution + a;
    return {
      prompt: `${v} + ${fmtOp(a, true)} = ${fmt(rhs)}`,
      answer: solution,
    };
  }
  if (kind === 1) {
    const a = signedMag(max);
    const rhs = solution - a;
    return {
      prompt: `${v} ${MINUS} ${fmtOp(a, true)} = ${fmt(rhs)}`,
      answer: solution,
    };
  }
  if (kind === 2) {
    const k = rand(2, 12);
    const rhs = k * solution;
    return { prompt: `${k}${v} = ${fmt(rhs)}`, answer: solution };
  }
  const k = rand(2, 12);
  // "x ÷ k = b" solve for x ⇒ x = k*b.
  const b = signedMag(Math.min(max, 20), false);
  const x = k * b;
  return {
    prompt: `${v} ${DIV} ${k} = ${fmt(b)}`,
    answer: x,
  };
}

/** Two-step evaluate with parentheses. */
function evaluateTwoStep(max: number): Question {
  const v = varName();
  const value = signedMag(Math.min(max, 40), false);
  const form = rand(0, 2);
  if (form === 0) {
    // k(v − a) + b
    const k = rand(2, 6);
    const a = signedMag(Math.min(max, 20));
    const b = signedMag(Math.min(max, 20));
    const answer = k * (value - a) + b;
    const tail = b < 0 ? `${MINUS} ${Math.abs(b)}` : b > 0 ? `+ ${b}` : "";
    const prompt = tail
      ? `${v} = ${fmt(value)}, ${k}(${v} ${MINUS} ${fmtOp(a, true)}) ${tail}`
      : `${v} = ${fmt(value)}, ${k}(${v} ${MINUS} ${fmtOp(a, true)})`;
    return { prompt, answer };
  }
  if (form === 1) {
    // k*v − (v + a)
    const k = rand(2, 6);
    const a = signedMag(Math.min(max, 20));
    const answer = k * value - (value + a);
    const inner = a < 0 ? `${v} ${MINUS} ${Math.abs(a)}` : `${v} + ${a}`;
    return {
      prompt: `${v} = ${fmt(value)}, ${k}${v} ${MINUS} (${inner})`,
      answer,
    };
  }
  // a − k(v + b)
  const k = rand(2, 5);
  const a = signedMag(max);
  const b = signedMag(Math.min(max, 15));
  const answer = a - k * (value + b);
  const inner = b < 0 ? `${v} ${MINUS} ${Math.abs(b)}` : `${v} + ${b}`;
  return {
    prompt: `${v} = ${fmt(value)}, ${fmt(a)} ${MINUS} ${k}(${inner})`,
    answer,
  };
}

/** Two-step solve constructed from a chosen integer solution. */
function solveTwoStep(max: number): Question {
  const v = varName();
  const solution = signedMag(Math.min(max, 40), false);
  const form = rand(0, 2);
  if (form === 0) {
    // kx + a = rhs
    const k = signedMag(6, false);
    const coeff = Math.abs(k) < 2 ? (k < 0 ? -2 : 2) : k;
    const a = signedMag(Math.min(max, 30));
    const rhs = coeff * solution + a;
    const left =
      coeff === 1
        ? `${v} + ${fmt(a)}`
        : coeff === -1
          ? `${MINUS}${v} + ${fmt(a)}`
          : `${fmt(coeff)}${v} + ${fmt(a)}`;
    // Normalize " + −3" style: if a is negative, use minus in prompt
    const leftClean =
      a < 0
        ? coeff === 1
          ? `${v} ${MINUS} ${Math.abs(a)}`
          : coeff === -1
            ? `${MINUS}${v} ${MINUS} ${Math.abs(a)}`
            : `${fmt(coeff)}${v} ${MINUS} ${Math.abs(a)}`
        : left;
    return { prompt: `${leftClean} = ${fmt(rhs)}`, answer: solution };
  }
  if (form === 1) {
    // k(v − a) = rhs
    const k = rand(2, 8);
    const a = signedMag(Math.min(max, 20));
    const rhs = k * (solution - a);
    return {
      prompt: `${k}(${v} ${MINUS} ${fmtOp(a, true)}) = ${fmt(rhs)}`,
      answer: solution,
    };
  }
  // −kx + a = rhs
  const k = rand(2, 6);
  const a = signedMag(Math.min(max, 30));
  const rhs = -k * solution + a;
  const mid = a < 0 ? `${MINUS}${k}${v} ${MINUS} ${Math.abs(a)}` : `${MINUS}${k}${v} + ${fmt(a)}`;
  return { prompt: `${mid} = ${fmt(rhs)}`, answer: solution };
}

/** Difficulty tier for blue/red matching. Band-aware for plain ops. */
export function tierOf(kind: QuestionKind, band: GradeBand): DifficultyTier {
  if (kind === "eval-one" || kind === "eval-two") return "eval";
  if (kind === "solve-one" || kind === "solve-two") return "solve";
  if (band === "4-5" || band === "6-7") {
    return kind === "plain-add" || kind === "plain-sub" ? "add-sub" : "mul-div";
  }
  return "plain";
}

function kindsForBand(band: GradeBand): QuestionKind[] {
  switch (band) {
    case "4-5":
    case "6-7":
      return PLAIN_KINDS;
    case "8-9":
      return [...PLAIN_KINDS, "eval-one", "solve-one"];
    case "10-12":
      return [...PLAIN_KINDS, "eval-two", "solve-two"];
  }
}

/** Pick a kind using the band's historical mix weights. */
export function pickKind(band: GradeBand): QuestionKind {
  switch (band) {
    case "4-5":
    case "6-7":
      return pick(PLAIN_KINDS);
    case "8-9": {
      // 50% plain, 25% eval-one, 25% solve-one
      const roll = rand(0, 3);
      if (roll <= 1) return pick(PLAIN_KINDS);
      if (roll === 2) return "eval-one";
      return "solve-one";
    }
    case "10-12": {
      // 20% plain, 40% eval-two, 40% solve-two
      const roll = rand(0, 4);
      if (roll === 0) return pick(PLAIN_KINDS);
      if (roll === 1 || roll === 2) return "eval-two";
      return "solve-two";
    }
  }
}

/** Pick a kind in the same difficulty tier as the peer (within this band). */
export function pickKindMatchingTier(band: GradeBand, peerKind: QuestionKind): QuestionKind {
  const tier = tierOf(peerKind, band);
  if (band === "4-5" || band === "6-7") {
    return pick(tier === "add-sub" ? ADD_SUB_KINDS : MUL_DIV_KINDS);
  }
  if (tier === "plain") return pick(PLAIN_KINDS);
  if (tier === "eval") return band === "8-9" ? "eval-one" : "eval-two";
  return band === "8-9" ? "solve-one" : "solve-two";
}

function buildQuestion(band: GradeBand, kind: QuestionKind): Question {
  const allowed = kindsForBand(band);
  const safeKind = allowed.includes(kind) ? kind : pickKind(band);

  switch (band) {
    case "4-5":
      return plainUnsigned(40, safeKind);
    case "6-7":
      return plainSigned(100, safeKind);
    case "8-9":
      if (safeKind === "eval-one") return evaluateOneStep(100);
      if (safeKind === "solve-one") return solveOneStep(100);
      return plainSigned(100, safeKind);
    case "10-12":
      if (safeKind === "eval-two") return evaluateTwoStep(100);
      if (safeKind === "solve-two") return solveTwoStep(100);
      return plainSigned(100, safeKind);
  }
}

export function makeQuestionWithKind(
  band: GradeBand = "4-5",
  kind?: QuestionKind,
): { question: Question; kind: QuestionKind } {
  const resolved = kind ?? pickKind(band);
  const allowed = kindsForBand(band);
  const safeKind = allowed.includes(resolved) ? resolved : pickKind(band);
  return { question: buildQuestion(band, safeKind), kind: safeKind };
}

export function makeQuestion(band: GradeBand = "4-5", kind?: QuestionKind): Question {
  return makeQuestionWithKind(band, kind).question;
}
