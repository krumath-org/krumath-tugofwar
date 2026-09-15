import { WIN_PULLS } from "@/lib/constants";
import {
  makeQuestionWithKind,
  pickKind,
  pickKindMatchingTier,
  type GradeBand,
  type Question,
  type QuestionKind,
} from "@/lib/math";

export type Side = "blue" | "red";

export type SideState = {
  question: Question;
  kind: QuestionKind;
  input: string;
  score: number;
  shaking: boolean;
};

export type GameState = {
  band: GradeBand;
  blue: SideState;
  red: SideState;
  position: number;
  pullKey: number;
  lastPuller: Side | null;
  winner: Side | null;
};

export type GameAction =
  | { type: "digit"; side: Side; digit: string }
  | { type: "backspace"; side: Side }
  | { type: "toggleSign"; side: Side }
  | { type: "submit"; side: Side }
  | { type: "clearShake"; side: Side }
  | { type: "grade"; band: GradeBand }
  | { type: "playAgain" }
  | { type: "resetAll" };

const freshSide = (band: GradeBand, score = 0, kind?: QuestionKind): SideState => {
  const made = makeQuestionWithKind(band, kind);
  return {
    question: made.question,
    kind: made.kind,
    input: "",
    score,
    shaking: false,
  };
};

/** Both sides get the same exact kind (dual refresh). */
const freshPair = (
  band: GradeBand,
  blueScore = 0,
  redScore = 0,
): { blue: SideState; red: SideState } => {
  const kind = pickKind(band);
  return {
    blue: freshSide(band, blueScore, kind),
    red: freshSide(band, redScore, kind),
  };
};

export const createInitialState = (band: GradeBand = "4-5"): GameState => {
  const { blue, red } = freshPair(band);
  return {
    band,
    blue,
    red,
    position: 0,
    pullKey: 0,
    lastPuller: null,
    winner: null,
  };
};

const getSide = (state: GameState, side: Side) => (side === "blue" ? state.blue : state.red);

const otherSide = (side: Side): Side => (side === "blue" ? "red" : "blue");

const withSide = (state: GameState, side: Side, next: SideState): GameState =>
  side === "blue" ? { ...state, blue: next } : { ...state, red: next };

/** Grade chips only change an idle rope (center, no winner). */
export const canChangeGrade = (state: GameState) => state.position === 0 && state.winner === null;

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "digit": {
      if (state.winner) return state;
      const s = getSide(state, action.side);
      if (s.shaking || s.input.length >= 5) return state;
      return withSide(state, action.side, {
        ...s,
        input: s.input + action.digit,
      });
    }
    case "backspace": {
      if (state.winner) return state;
      const s = getSide(state, action.side);
      if (s.shaking || s.input.length === 0) return state;
      return withSide(state, action.side, {
        ...s,
        input: s.input.slice(0, -1),
      });
    }
    case "toggleSign": {
      if (state.winner) return state;
      const s = getSide(state, action.side);
      if (s.shaking) return state;
      return withSide(state, action.side, {
        ...s,
        input: s.input.startsWith("-") ? s.input.slice(1) : `-${s.input}`,
      });
    }
    case "submit": {
      if (state.winner) return state;
      const s = getSide(state, action.side);
      if (s.shaking) return state;
      const value = parseInt(s.input, 10);
      if (s.input === "" || Number.isNaN(value)) return state;

      if (value !== s.question.answer) {
        return withSide(state, action.side, {
          ...s,
          input: "",
          shaking: true,
        });
      }

      const nextPos = action.side === "blue" ? state.position - 1 : state.position + 1;
      const won = Math.abs(nextPos) >= WIN_PULLS;
      const peer = getSide(state, otherSide(action.side));
      const nextKind = pickKindMatchingTier(state.band, peer.kind);
      const made = makeQuestionWithKind(state.band, nextKind);

      return {
        ...state,
        position: nextPos,
        pullKey: state.pullKey + 1,
        lastPuller: action.side,
        winner: won ? action.side : null,
        ...(action.side === "blue"
          ? {
              blue: {
                ...s,
                input: "",
                question: made.question,
                kind: made.kind,
                score: won ? s.score + 1 : s.score,
              },
            }
          : {
              red: {
                ...s,
                input: "",
                question: made.question,
                kind: made.kind,
                score: won ? s.score + 1 : s.score,
              },
            }),
      };
    }
    case "clearShake": {
      const s = getSide(state, action.side);
      if (!s.shaking) return state;
      return withSide(state, action.side, { ...s, shaking: false });
    }
    case "grade": {
      if (!canChangeGrade(state)) return state;
      if (action.band === state.band) return state;
      const { blue, red } = freshPair(action.band, state.blue.score, state.red.score);
      return {
        ...state,
        band: action.band,
        position: 0,
        winner: null,
        lastPuller: null,
        blue,
        red,
      };
    }
    case "playAgain": {
      const { blue, red } = freshPair(state.band, state.blue.score, state.red.score);
      return {
        ...state,
        position: 0,
        winner: null,
        lastPuller: null,
        blue,
        red,
      };
    }
    case "resetAll":
      return createInitialState(state.band);
    default:
      return state;
  }
}
