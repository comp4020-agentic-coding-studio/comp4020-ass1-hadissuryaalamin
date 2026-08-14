import { describe, expect, it } from "vitest";
import { euclidean, search } from "./graph-search.ts";
import { createOpenGraph, createTrapGraph, edgeId } from "./graphs.ts";

describe("search on the open graph", () => {
  const { nodes, edges, start, end } = createOpenGraph();

  it("finds the same true-shortest path at every weight, since nothing is blocked", () => {
    const trueOptimal = search(nodes, edges, new Set(), start, end, 0).pathLength;
    expect(trueOptimal).toBeGreaterThan(0);

    for (const weight of [0, 1, 2, 3]) {
      const result = search(nodes, edges, new Set(), start, end, weight);
      expect(result.pathLength).toBe(trueOptimal);
      expect(result.path[0]).toBe(start);
      expect(result.path.at(-1)).toBe(end);
    }
  });

  it("reports pathLength 0 when start and end are the same node", () => {
    const result = search(nodes, edges, new Set(), start, start, 1);
    expect(result.pathLength).toBe(0);
    expect(result.path).toEqual([start]);
  });

  it("reports pathLength -1 when every edge touching the end is blocked", () => {
    const blocked = new Set(edges.filter((e) => e.a === end || e.b === end).map((e) => e.id));
    const result = search(nodes, edges, blocked, start, end, 1);
    expect(result.pathLength).toBe(-1);
    expect(result.path).toEqual([]);
  });

  it("expands no more nodes as weight increases (greedier search does less work)", () => {
    let previous = Infinity;
    for (const weight of [0, 1, 2, 3]) {
      const result = search(nodes, edges, new Set(), start, end, weight);
      expect(result.expandedCount).toBeLessThanOrEqual(previous);
      previous = result.expandedCount;
    }
  });

  it("returns a path where every consecutive pair is a real edge", () => {
    const edgeIds = new Set(edges.map((e) => e.id));
    const result = search(nodes, edges, new Set(), start, end, 1);
    for (let i = 1; i < result.path.length; i++) {
      expect(edgeIds.has(edgeId(result.path[i - 1], result.path[i]))).toBe(true);
    }
  });
});

describe("search on the trap graph", () => {
  const { nodes, edges, start, end } = createTrapGraph();

  it("is fooled by the decoy node once weight pushes past admissible (weight > 1)", () => {
    const trueOptimal = search(nodes, edges, new Set(), start, end, 1).pathLength;
    const dijkstra = search(nodes, edges, new Set(), start, end, 0).pathLength;
    const fooled = search(nodes, edges, new Set(), start, end, 3).pathLength;

    expect(trueOptimal).toBeGreaterThan(0);
    expect(dijkstra).toBe(trueOptimal);
    expect(fooled).toBeGreaterThan(trueOptimal);
  });
});

describe("per-step trace", () => {
  const { nodes, edges, start, end } = createOpenGraph();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edgeWeight = new Map<string, number>();
  for (const e of edges) {
    edgeWeight.set(edgeId(e.a, e.b), e.weight);
  }
  const weight = 1;
  const result = search(nodes, edges, new Set(), start, end, weight);

  it("records exactly one step per expanded node", () => {
    expect(result.steps.length).toBe(result.expandedCount);
  });

  it("computes f as g + weight * h for every step", () => {
    for (const step of result.steps) {
      const h = euclidean(nodeById.get(step.nodeId)!, nodeById.get(end)!);
      expect(step.f).toBeCloseTo(step.g + weight * h, 6);
    }
  });

  it("gives relaxed neighbors a tentativeG equal to g plus the edge's own weight", () => {
    for (const step of result.steps) {
      for (const neighbor of step.neighbors) {
        if (neighbor.status !== "relaxed") continue;
        const w = edgeWeight.get(edgeId(step.nodeId, neighbor.nodeId));
        expect(neighbor.tentativeG).toBeCloseTo(step.g + (w ?? Number.NaN), 6);
      }
    }
  });

  it("gives blocked or closed neighbors no cost", () => {
    for (const step of result.steps) {
      for (const neighbor of step.neighbors) {
        if (neighbor.status === "blocked" || neighbor.status === "closed") {
          expect(neighbor.tentativeG).toBeNull();
          expect(neighbor.f).toBeNull();
        }
      }
    }
  });

  it("leaves the end's own step with no expanded neighbors", () => {
    const endStep = result.steps.at(-1);
    expect(endStep?.nodeId).toBe(end);
    expect(endStep?.neighbors).toEqual([]);
  });
});
