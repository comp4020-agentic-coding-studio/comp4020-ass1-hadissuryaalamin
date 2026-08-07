import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Turns the mechanically-checkable lines of the Assignment 1 spec into tests:
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/
//
// Not asserted here because a person, not a test, judges them at the crit:
// "it works at both marking viewports" and "one strong idea with a point of
// view, and nothing else". "Deployed and live" is checked by CI's deploy job,
// not locally. "Static and client-side throughout" holds as long as the
// invariants in spec/invariants.test.ts stay green.
//
// This file was rewritten (not preserved) when the concept pivoted from a
// rule-based tool-selection pipeline to this hidden-state-probe guessing
// game — see PLAN.md. It re-derives the contract from the new mechanic
// rather than adapting the old assertions.

const distPath = resolve("dist/index.html");
const doc = existsSync(distPath)
  ? new JSDOM(readFileSync(distPath, "utf8")).window.document
  : null;

// Spec: "the visitor does something that changes what they see — state the
// core interaction plainly enough to write a test for it." The core
// interaction here: read a prompt and the model's stated reasoning, guess
// whether a tool is really needed, then watch the layer-stack animation
// reveal the hidden-state probe's verdict. This only checks the structural
// hooks exist in the shipped markup, not the animation itself.
describe("core interaction: the probe guessing game is present in the shipped page", () => {
  it("built the home page", () => {
    expect(existsSync(distPath), "run `pnpm build` first").toBe(true);
  });

  it("shows the current round's prompt", () => {
    expect(doc?.querySelector('[data-testid="prompt-card"]')).toBeTruthy();
  });

  it("shows the model's stated reasoning before the visitor guesses", () => {
    expect(doc?.querySelector('[data-testid="stated-reasoning"]')).toBeTruthy();
  });

  it("has a control to guess 'needs a tool' and a control to guess 'no tool needed'", () => {
    expect(doc?.querySelector('[data-testid="guess-yes"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="guess-no"]')).toBeTruthy();
  });

  it("has a layer-stack diagram and a probe box for the reveal", () => {
    expect(doc?.querySelector('[data-testid="layer-stack"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="probe-box"]')).toBeTruthy();
  });

  it("tracks a running score across rounds", () => {
    expect(doc?.querySelector('[data-testid="score"]')).toBeTruthy();
  });

  it("has an end-of-session summary, initially hidden", () => {
    const summary = doc?.querySelector('[data-testid="summary"]');
    expect(summary).toBeTruthy();
    expect(summary?.hasAttribute("hidden")).toBe(true);
  });
});

// Spec: "clear distinction between tool call and no tool call". The decision
// itself is deliberately hand-authored data, not computed — a real
// hidden-state probe needs a real model, which this static, client-side site
// doesn't have. Tested as a pure data contract so it survives whatever UI or
// animation ends up wrapping it.
describe("round data: the core mechanic", () => {
  it("ships exactly 8 hand-authored rounds", async () => {
    const { ROUNDS } = await import("../src/lib/probe-rounds.ts");
    expect(ROUNDS.length).toBe(8);
  });

  it("doesn't strawman the model: some rounds agree with its stated reasoning, some don't", async () => {
    const { ROUNDS, statedReasoningAgrees } = await import("../src/lib/probe-rounds.ts");
    const agreeing = ROUNDS.filter(statedReasoningAgrees);
    const disagreeing = ROUNDS.filter((round) => !statedReasoningAgrees(round));
    expect(agreeing.length).toBeGreaterThan(0);
    expect(disagreeing.length).toBeGreaterThan(0);
  });
});
