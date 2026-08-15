import { describe, expect, it } from "vitest";
import { search } from "./dijkstra.ts";
import { END_ID, GRAPH_EDGES, GRAPH_NODES, START_ID } from "./example-graph.ts";
import { narrateStep } from "./narrate-step.ts";

describe("narrateStep on the fixed example graph", () => {
  const result = search(GRAPH_NODES, GRAPH_EDGES, START_ID, END_ID);
  const totalSteps = result.steps.length + 1;

  it("announces readiness at step 0", () => {
    expect(narrateStep(result, 0, totalSteps)).toBe(
      "Ready: g[S] = 0. 7 nodes to pop — press Next or Run to begin.",
    );
  });

  it("narrates a pop where every neighbor is freshly relaxed (S)", () => {
    expect(narrateStep(result, 1, totalSteps)).toBe(
      "Pop S: g=0. Relax A to g=2. Relax B to g=5. Relax C to g=4.",
    );
  });

  it("narrates a pop with both a relax and a skip (B)", () => {
    expect(narrateStep(result, 3, totalSteps)).toBe(
      "Pop B: g=3. Skip C — already reached more cheaply. Relax D to g=7.",
    );
  });

  it("narrates a pop with both a closed and a skipped neighbor (E)", () => {
    expect(narrateStep(result, 6, totalSteps)).toBe(
      "Pop E: g=7. D already closed. Skip T — already reached more cheaply.",
    );
  });

  it("narrates the end pop, which has no neighbors to expand (T)", () => {
    expect(narrateStep(result, 7, totalSteps)).toBe(
      "Pop T: g=8. That's the end — break before expanding.",
    );
  });

  it("announces the finish state at the final step", () => {
    expect(narrateStep(result, totalSteps, totalSteps)).toBe(
      "Finished: reconstructed the path S → A → B → D → T · total cost 8.",
    );
  });
});
