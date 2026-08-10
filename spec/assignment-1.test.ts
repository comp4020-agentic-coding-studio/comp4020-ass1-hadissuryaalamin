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
// This file was rewritten (not preserved) when the concept pivoted a second
// time, from the hidden-state-probe guessing game to this A* weight-dial
// visualizer — see PLAN.md. It re-derives the contract from the new mechanic
// rather than adapting the old assertions.

const distPath = resolve("dist/index.html");
const doc = existsSync(distPath) ? new JSDOM(readFileSync(distPath, "utf8")).window.document : null;

// Spec: "the visitor does something that changes what they see — state the
// core interaction plainly enough to write a test for it." The core
// interaction here: draw walls (or load the trap maze), drag the weight
// slider, hit Run, and watch the search animate then report whether it found
// the true shortest path. This only checks the structural hooks exist in the
// shipped markup, not the animation itself.
describe("core interaction: the weight-dial pathfinder is present in the shipped page", () => {
  it("built the home page", () => {
    expect(existsSync(distPath), "run `pnpm build` first").toBe(true);
  });

  it("renders the full 16x10 grid of cells", () => {
    expect(doc?.querySelectorAll('[data-testid="grid-cell"]').length).toBe(160);
  });

  it("has a mode control for each of draw / erase / set-start / set-end", () => {
    expect(doc?.querySelector('[data-testid="mode-draw"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="mode-erase"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="mode-start"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="mode-end"]')).toBeTruthy();
  });

  it("has a heuristic-weight slider spanning Dijkstra (0) through past A* (3)", () => {
    const slider = doc?.querySelector('[data-testid="weight-slider"]');
    expect(slider).toBeTruthy();
    expect(slider?.getAttribute("min")).toBe("0");
    expect(slider?.getAttribute("max")).toBe("3");
  });

  it("has Run, Clear walls, and Load trap maze controls", () => {
    expect(doc?.querySelector('[data-testid="run-button"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="clear-walls-button"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="load-trap-button"]')).toBeTruthy();
  });

  it("has a result banner, initially hidden", () => {
    const banner = doc?.querySelector('[data-testid="result-banner"]');
    expect(banner).toBeTruthy();
    expect(banner?.hasAttribute("hidden")).toBe(true);
  });

  it("has a run-history table for comparing weights on the same maze", () => {
    expect(doc?.querySelector('[data-testid="history-table"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="history-body"]')).toBeTruthy();
  });

  // The grid renders as a node-edge graph, not a square-cell grid: 160 nodes
  // (checked above) plus every connecting edge between orthogonal neighbors.
  it("connects the 16x10 grid of nodes with edges (294 = 10x15 right + 9x16 down)", () => {
    expect(doc?.querySelectorAll('[data-testid="grid-edge"]').length).toBe(294);
  });

  it("has a pseudocode panel with one line per step of the search loop", () => {
    expect(doc?.querySelector('[data-testid="pseudocode-panel"]')).toBeTruthy();
    expect(doc?.querySelectorAll('[data-testid="pseudo-line"]').length).toBe(11);
  });
});

// Spec: "clear distinction between [outcomes]". The distinction this site
// demonstrates is optimal vs. not — tested as a pure data contract on the
// search engine itself, so it survives whatever UI or animation ends up
// wrapping it. See src/lib/astar.test.ts for the full proof; this only checks
// that the shipped preset maze is wired to the same result.
describe("trap maze: the core mechanic", () => {
  it("the shipped trap-maze preset reproduces the optimal-vs-fooled split", async () => {
    const { search } = await import("../src/lib/astar.ts");
    const { createTrapMaze, DEFAULT_START, DEFAULT_END } = await import("../src/lib/mazes.ts");
    const walls = createTrapMaze();

    const trueOptimal = search(walls, DEFAULT_START, DEFAULT_END, 1).pathLength;
    const fooled = search(walls, DEFAULT_START, DEFAULT_END, 3).pathLength;

    expect(trueOptimal).toBeGreaterThan(0);
    expect(fooled).toBeGreaterThan(trueOptimal);
  });
});
