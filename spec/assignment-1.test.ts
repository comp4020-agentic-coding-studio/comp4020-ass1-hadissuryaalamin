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

const distPath = resolve("dist/index.html");
const doc = existsSync(distPath)
  ? new JSDOM(readFileSync(distPath, "utf8")).window.document
  : null;

// Spec: "the visitor does something that changes what they see — state the
// core interaction plainly enough to write a test for it." The core
// interaction here: type a prompt, submit it, watch it animate through
// User Prompt -> LLM -> Tool Decision -> Tool Call (if needed) -> Tool
// Result -> Final Response. This only checks the structural hooks exist in
// the shipped markup, not the animation itself.
describe("core interaction: the prompt pipeline is present in the shipped page", () => {
  it("built the home page", () => {
    expect(existsSync(distPath), "run `pnpm build` first").toBe(true);
  });

  it("has a prompt input the visitor can type into", () => {
    expect(doc?.querySelector('[data-testid="prompt-input"]')).toBeTruthy();
  });

  it("has a control that submits the prompt", () => {
    expect(doc?.querySelector('[data-testid="prompt-submit"]')).toBeTruthy();
  });

  it("has a distinct element for every stage of the pipeline", () => {
    const stages = [
      "stage-prompt",
      "stage-llm",
      "stage-decision",
      "stage-tool-call",
      "stage-tool-result",
      "stage-final-response",
    ];
    for (const stage of stages) {
      expect(
        doc?.querySelector(`[data-testid="${stage}"]`),
        `missing [data-testid="${stage}"] — one element per pipeline stage`,
      ).toBeTruthy();
    }
  });
});

// Spec: "clear distinction between tool call and no tool call", with example
// tools get_schedule, get_next, add_task. Tested as a pure function so the
// contract survives whatever UI or animation ends up wrapping it — this is
// the actual "LLM decides" mechanic, and it's the one thing in this prototype
// that must be simulated rather than a real model call, since the deployed
// site is static and client-side only.
describe("tool-call decision: the core mechanic", () => {
  const TOOL_NAMES = ["get_schedule", "get_next", "add_task"];

  it("calls a tool for a prompt that needs live data", async () => {
    const { decideTool } = await import("../src/lib/agent-logic.ts");
    const decision = decideTool("What is on my schedule tomorrow?");
    expect(decision.toolCall).not.toBeNull();
    expect(TOOL_NAMES).toContain(decision.toolCall?.name);
  });

  it("answers directly, with no tool call, for a prompt needing no live data", async () => {
    const { decideTool } = await import("../src/lib/agent-logic.ts");
    const decision = decideTool("Explain reinforcement learning.");
    expect(decision.toolCall).toBeNull();
  });
});
