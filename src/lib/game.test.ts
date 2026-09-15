import { describe, expect, it } from "vitest";
import { WIN_PULLS } from "@/lib/constants";
import { createInitialState, gameReducer, type GameState, type SideState } from "@/lib/game";
import { tierOf, type Question, type QuestionKind } from "@/lib/math";

const q = (answer: number): Question => ({
  prompt: `${answer} + 0`,
  answer,
});

function withSides(
  state: GameState,
  blue: { answer?: number; input?: string; score?: number; kind?: QuestionKind },
  red: { answer?: number; input?: string; score?: number; kind?: QuestionKind },
  extras: Partial<GameState> = {},
): GameState {
  const patch = (
    current: SideState,
    next: { answer?: number; input?: string; score?: number; kind?: QuestionKind },
  ): SideState => ({
    ...current,
    question: next.answer !== undefined ? q(next.answer) : current.question,
    kind: next.kind ?? current.kind,
    input: next.input ?? current.input,
    score: next.score ?? current.score,
  });

  return {
    ...state,
    ...extras,
    blue: patch(state.blue, blue),
    red: patch(state.red, red),
  };
}

describe("gameReducer smoke", () => {
  it("applies both pulls when blue and red submit correctly in sequence (no lost pull)", () => {
    let state = withSides(
      createInitialState(),
      { answer: 4, input: "4" },
      { answer: 6, input: "6" },
      { position: 0 },
    );

    state = gameReducer(state, { type: "submit", side: "blue" });
    state = gameReducer(state, { type: "submit", side: "red" });

    expect(state.position).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.pullKey).toBe(2);
  });

  it("at position 7, dual correct submits keep winner/rope/score consistent", () => {
    let state = withSides(
      createInitialState(),
      { answer: 1, input: "1", score: 0 },
      { answer: 2, input: "2", score: 0 },
      { position: 7 },
    );

    // Blue pulls to 6, then red to 7 — neither wins; both pulls count
    state = gameReducer(state, { type: "submit", side: "blue" });
    expect(state.position).toBe(6);
    expect(state.winner).toBeNull();

    state = gameReducer(state, { type: "submit", side: "red" });
    expect(state.position).toBe(7);
    expect(state.winner).toBeNull();
    expect(state.blue.score).toBe(0);
    expect(state.red.score).toBe(0);
  });

  it("at position 7, red correct submit wins with matching score and rope", () => {
    let state = withSides(
      createInitialState(),
      { answer: 1, input: "" },
      { answer: 9, input: "9", score: 2 },
      { position: 7 },
    );

    state = gameReducer(state, { type: "submit", side: "red" });

    expect(state.position).toBe(WIN_PULLS);
    expect(state.winner).toBe("red");
    expect(state.red.score).toBe(3);
    expect(state.blue.score).toBe(0);
  });

  it("after a win, further submits do not move the rope or score", () => {
    let state = withSides(
      createInitialState(),
      { answer: 5, input: "5", score: 0 },
      { answer: 9, input: "9", score: 0 },
      { position: 7 },
    );

    state = gameReducer(state, { type: "submit", side: "red" });
    expect(state.winner).toBe("red");
    expect(state.position).toBe(8);
    expect(state.red.score).toBe(1);

    state = gameReducer(state, { type: "submit", side: "blue" });
    expect(state.position).toBe(8);
    expect(state.winner).toBe("red");
    expect(state.blue.score).toBe(0);
    expect(state.red.score).toBe(1);
  });

  it("submit → pull → win → rematch keeps series score", () => {
    let state = withSides(
      createInitialState(),
      { answer: 1, input: "1" },
      { answer: 1, input: "" },
      { position: -(WIN_PULLS - 1) },
    );

    state = gameReducer(state, { type: "submit", side: "blue" });
    expect(state.winner).toBe("blue");
    expect(state.blue.score).toBe(1);
    expect(Math.abs(state.position)).toBe(WIN_PULLS);

    state = gameReducer(state, { type: "playAgain" });
    expect(state.winner).toBeNull();
    expect(state.position).toBe(0);
    expect(state.blue.score).toBe(1);
    expect(state.red.score).toBe(0);
  });

  it("backspace deletes one character", () => {
    let state = withSides(createInitialState(), { input: "12" }, { input: "" });
    state = gameReducer(state, { type: "backspace", side: "blue" });
    expect(state.blue.input).toBe("1");
  });

  it("rejects grade change while rope is away from center", () => {
    let state = withSides(createInitialState(), {}, {}, { position: 2, band: "4-5" });
    state = gameReducer(state, { type: "grade", band: "6-7" });
    expect(state.band).toBe("4-5");
    expect(state.position).toBe(2);
  });

  it("allows grade change at center", () => {
    let state = createInitialState("4-5");
    state = gameReducer(state, { type: "grade", band: "8-9" });
    expect(state.band).toBe("8-9");
    expect(state.position).toBe(0);
  });

  it("wrong answer shakes and blocks digits until clearShake", () => {
    let state = withSides(createInitialState(), { answer: 4, input: "9" }, {});
    state = gameReducer(state, { type: "submit", side: "blue" });
    expect(state.blue.shaking).toBe(true);
    expect(state.blue.input).toBe("");
    expect(state.position).toBe(0);

    state = gameReducer(state, { type: "digit", side: "blue", digit: "1" });
    expect(state.blue.input).toBe("");

    state = gameReducer(state, { type: "clearShake", side: "blue" });
    state = gameReducer(state, { type: "digit", side: "blue", digit: "1" });
    expect(state.blue.input).toBe("1");
  });

  it("starts both sides on the same question kind", () => {
    for (let i = 0; i < 20; i++) {
      const state = createInitialState("8-9");
      expect(state.blue.kind).toBe(state.red.kind);
    }
  });

  it("after a correct submit, new question stays in the opponent tier", () => {
    let state = withSides(
      createInitialState("4-5"),
      { answer: 7, input: "7", kind: "plain-add" },
      { kind: "plain-mul" },
    );
    state = gameReducer(state, { type: "submit", side: "blue" });
    expect(tierOf(state.blue.kind, "4-5")).toBe(tierOf(state.red.kind, "4-5"));
    expect(tierOf(state.blue.kind, "4-5")).toBe("mul-div");
  });

  it("grade change dual-refreshes both sides to the same kind", () => {
    let state = createInitialState("4-5");
    state = gameReducer(state, { type: "grade", band: "10-12" });
    expect(state.blue.kind).toBe(state.red.kind);
  });
});
