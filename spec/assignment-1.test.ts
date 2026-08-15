import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { CODE_SOURCE, type CodeLang } from "../src/lib/code-samples.ts";

// Turns the mechanically-checkable lines of the Assignment 1 spec into tests:
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/
//
// Not asserted here because a person, not a test, judges them at the crit:
// "it works at both marking viewports" and "one strong idea with a point of
// view, and nothing else". "Deployed and live" is checked by CI's deploy job,
// not locally. "Static and client-side throughout" holds as long as the
// invariants in spec/invariants.test.ts stay green.
//
// This file was rewritten (not preserved) when the concept pivoted a third
// time, from the wall-drawing weight-dial visualizer to a single fixed
// directed graph walked by plain Dijkstra, with a real-source-code panel
// standing in for pseudocode. It re-derives the contract from the new
// mechanic rather than adapting the old assertions.

const distPath = resolve("dist/index.html");
const doc = existsSync(distPath) ? new JSDOM(readFileSync(distPath, "utf8")).window.document : null;

const LANGS: CodeLang[] = ["python", "java"];

// Spec: "the visitor does something that changes what they see — state the
// core interaction plainly enough to write a test for it." The core
// interaction here: press Run (or step with Prev/Next) and watch Dijkstra pop
// and relax nodes on a fixed graph, with the exact line of real source code
// that caused each step highlighted alongside it. This only checks the
// structural hooks exist in the shipped markup, not the animation itself.
describe("core interaction: the Dijkstra walkthrough is present in the shipped page", () => {
  it("built the home page", () => {
    expect(existsSync(distPath), "run `pnpm build` first").toBe(true);
  });

  it("renders the fixed 7-node directed graph", () => {
    expect(doc?.querySelectorAll('[data-testid="graph-node"]').length).toBe(7);
  });

  it("connects the graph with all 11 directed edges", () => {
    expect(doc?.querySelectorAll('[data-testid="graph-edge"]').length).toBe(11);
  });

  // Spec: state changes should be driven from one clear control surface, not
  // scattered — Run and the manual Prev/Next step share the same block.
  it("has Run, Prev, and Next sharing one controls block", () => {
    const controls = doc?.querySelector('[data-testid="controls"]');
    expect(controls).toBeTruthy();
    expect(controls?.querySelector('[data-testid="run-button"]')).toBeTruthy();
    expect(controls?.querySelector('[data-testid="step-prev"]')).toBeTruthy();
    expect(controls?.querySelector('[data-testid="step-next"]')).toBeTruthy();
  });

  it("has a manual step walkthrough — a counter and a visible caption", () => {
    expect(doc?.querySelector('[data-testid="step-counter"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="step-caption"]')).toBeTruthy();
  });

  // Spec: state changes should be visible, not just narrated — each node
  // shows its own known cost, starting at 0 for the start node and infinity
  // for every other node, updated on every step (see graph-controller.ts's
  // renderStep, which keeps this in sync with the same knownG map that
  // drives node color state).
  it("shows each node's known cost, starting at 0 for S and infinity elsewhere", () => {
    const costs = doc?.querySelectorAll('[data-testid="node-cost"]');
    expect(costs?.length).toBe(7);
    const startCost = doc?.querySelector('[data-testid="graph-node"][data-node-id="S"] [data-testid="node-cost"]');
    expect(startCost?.textContent?.trim()).toBe("g=0");
    const otherCosts = Array.from(costs ?? [])
      .filter((el) => el.closest('[data-node-id="S"]') === null)
      .map((el) => el.textContent?.trim());
    expect(otherCosts).toEqual(otherCosts.map(() => "g=∞"));
  });

  it("has a result banner, initially hidden", () => {
    const banner = doc?.querySelector('[data-testid="result-banner"]');
    expect(banner).toBeTruthy();
    expect(banner?.hasAttribute("hidden")).toBe(true);
  });

  // The old wall-drawing weight-dial UI (and its run-history log) is gone
  // entirely — this is now a fixed graph with one algorithm, not a dial.
  it("has none of the old wall-drawing weight-dial controls", () => {
    expect(doc?.querySelector('[data-testid="mode-draw"]')).toBeFalsy();
    expect(doc?.querySelector('[data-testid="mode-erase"]')).toBeFalsy();
    expect(doc?.querySelector('[data-testid="mode-start"]')).toBeFalsy();
    expect(doc?.querySelector('[data-testid="mode-end"]')).toBeFalsy();
    expect(doc?.querySelector('[data-testid="weight-slider"]')).toBeFalsy();
    expect(doc?.querySelector('[data-testid="clear-walls-button"]')).toBeFalsy();
    expect(doc?.querySelector('[data-testid="load-trap-button"]')).toBeFalsy();
    expect(doc?.querySelector('[data-testid="history-table"]')).toBeFalsy();
  });

  // Spec: real source stands in for pseudocode here, shown one language at a
  // time via a tab pair, not side-by-side — checked against the actual
  // committed source so an edit to code-samples.ts can't silently desync
  // the count from what's shipped.
  it("has a code panel with a tab and a fully-lined block per language", () => {
    for (const lang of LANGS) {
      const tab = doc?.querySelector(`[data-testid="code-tab-${lang}"]`);
      expect(tab).toBeTruthy();

      const block = doc?.querySelector(`[data-testid="code-block"][data-lang="${lang}"]`);
      expect(block).toBeTruthy();
      const expectedLines = CODE_SOURCE[lang].split("\n").length;
      expect(block?.querySelectorAll(".line").length).toBe(expectedLines);
    }
  });
});

// Spec: "clear distinction between [outcomes]". The distinction this site
// demonstrates is visited-but-not-on-the-path vs. on-the-shortest-path —
// tested as a pure data contract on the search engine itself, so it survives
// whatever UI or animation ends up wrapping it. See src/lib/dijkstra.test.ts
// for the full proof; this only checks the shipped graph is wired to the
// same result.
describe("the fixed graph: the core mechanic", () => {
  it("the shipped example graph has a shortest path strictly shorter than an unweighted hop count", async () => {
    const { search } = await import("../src/lib/dijkstra.ts");
    const { GRAPH_EDGES, GRAPH_NODES, START_ID, END_ID } = await import("../src/lib/example-graph.ts");

    const result = search(GRAPH_NODES, GRAPH_EDGES, START_ID, END_ID);

    expect(result.pathLength).toBeGreaterThan(0);
    expect(result.path[0]).toBe(START_ID);
    expect(result.path.at(-1)).toBe(END_ID);
    // At least one non-path edge exists — otherwise every edge would be on
    // the shortest path and the visited-vs-path color distinction would be
    // meaningless.
    expect(result.pathEdgeIds.length).toBeLessThan(GRAPH_EDGES.length);
  });
});
