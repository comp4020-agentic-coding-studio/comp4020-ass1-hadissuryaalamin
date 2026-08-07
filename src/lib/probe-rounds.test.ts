import { describe, expect, it } from "vitest";
import { ROUNDS, statedReasoningAgrees } from "./probe-rounds.ts";

describe("probe rounds", () => {
  it("has exactly 8 hand-authored rounds", () => {
    expect(ROUNDS.length).toBe(8);
  });

  it("gives every round a unique id, prompt, and non-empty stated reasoning", () => {
    const ids = new Set(ROUNDS.map((round) => round.id));
    expect(ids.size).toBe(ROUNDS.length);
    for (const round of ROUNDS) {
      expect(round.prompt.trim().length).toBeGreaterThan(0);
      expect(round.statedReasoning.trim().length).toBeGreaterThan(0);
    }
  });

  it("isn't a strawman: some rounds agree with the model's stated reasoning, some don't", () => {
    const agreeing = ROUNDS.filter(statedReasoningAgrees);
    const disagreeing = ROUNDS.filter((round) => !statedReasoningAgrees(round));
    expect(agreeing.length).toBeGreaterThan(0);
    expect(disagreeing.length).toBeGreaterThan(0);
  });

  it("includes both under-calling and over-calling disagreements, not just one direction", () => {
    const disagreeing = ROUNDS.filter((round) => !statedReasoningAgrees(round));
    const underCalled = disagreeing.filter((round) => round.hiddenStateNeedsTool && !round.modelStatedNeedsTool);
    const overCalled = disagreeing.filter((round) => !round.hiddenStateNeedsTool && round.modelStatedNeedsTool);
    expect(underCalled.length).toBeGreaterThan(0);
    expect(overCalled.length).toBeGreaterThan(0);
  });
});
