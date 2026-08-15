import { describe, expect, it } from "vitest";
import { search } from "./dijkstra.ts";
import { END_ID, GRAPH_EDGES, GRAPH_NODES, START_ID } from "./example-graph.ts";

describe("Dijkstra on the fixed example graph", () => {
  const result = search(GRAPH_NODES, GRAPH_EDGES, START_ID, END_ID);

  it("pops nodes in the hand-traced order S, A, B, C, D, E, T", () => {
    expect(result.visitedOrder).toEqual(["S", "A", "B", "C", "D", "E", "T"]);
  });

  it("has exactly one step per popped node", () => {
    expect(result.steps.length).toBe(7);
    expect(result.expandedCount).toBe(7);
  });

  it("finds the shortest path S -> A -> B -> D -> T with total weight 8", () => {
    expect(result.path).toEqual(["S", "A", "B", "D", "T"]);
    expect(result.pathLength).toBe(8);
    expect(result.pathEdgeIds).toEqual(["S-A", "A-B", "B-D", "D-T"]);
  });

  it("relaxes B down from 5 (via S) to 3 (via A) before popping it", () => {
    const sStep = result.steps[0];
    const bFromS = sStep.neighbors.find((n) => n.nodeId === "B");
    expect(bFromS?.status).toBe("relaxed");
    expect(bFromS?.tentativeG).toBe(5);

    const aStep = result.steps[1];
    const bFromA = aStep.neighbors.find((n) => n.nodeId === "B");
    expect(bFromA?.status).toBe("relaxed");
    expect(bFromA?.tentativeG).toBe(3);

    const bStep = result.steps.find((s) => s.nodeId === "B");
    expect(bStep?.g).toBe(3);
  });

  it("relaxes D down from 9 (via A) to 7 (via B) before popping it", () => {
    const aStep = result.steps[1];
    const dFromA = aStep.neighbors.find((n) => n.nodeId === "D");
    expect(dFromA?.status).toBe("relaxed");
    expect(dFromA?.tentativeG).toBe(9);

    const bStep = result.steps[2];
    const dFromB = bStep.neighbors.find((n) => n.nodeId === "D");
    expect(dFromB?.status).toBe("relaxed");
    expect(dFromB?.tentativeG).toBe(7);

    const dStep = result.steps.find((s) => s.nodeId === "D");
    expect(dStep?.g).toBe(7);
  });

  it("ties D and E at g=7 and pops D first by insertion order", () => {
    const dIndex = result.visitedOrder.indexOf("D");
    const eIndex = result.visitedOrder.indexOf("E");
    const dStep = result.steps[dIndex];
    const eStep = result.steps[eIndex];
    expect(dStep.g).toBe(7);
    expect(eStep.g).toBe(7);
    expect(dIndex).toBeLessThan(eIndex);
  });

  it("skips B->C (already reached more cheaply) and closes E->D, E->T off the winning path", () => {
    const bStep = result.steps.find((s) => s.nodeId === "B");
    const bToC = bStep?.neighbors.find((n) => n.nodeId === "C");
    expect(bToC?.status).toBe("skipped");

    const eStep = result.steps.find((s) => s.nodeId === "E");
    const eToD = eStep?.neighbors.find((n) => n.nodeId === "D");
    const eToT = eStep?.neighbors.find((n) => n.nodeId === "T");
    expect(eToD?.status).toBe("closed");
    expect(eToT?.status).toBe("skipped");
  });

  it("the end's step has no neighbors — the loop breaks before expanding it", () => {
    expect(result.steps.at(-1)?.nodeId).toBe("T");
    expect(result.steps.at(-1)?.neighbors).toEqual([]);
  });

  it("reports the start node as visited even when start === end", () => {
    const trivial = search(GRAPH_NODES, GRAPH_EDGES, START_ID, START_ID);
    expect(trivial.path).toEqual(["S"]);
    expect(trivial.pathLength).toBe(0);
    expect(trivial.pathEdgeIds).toEqual([]);
  });

  it("returns pathLength -1 and an empty path when the end is unreachable", () => {
    const unreachable = search(GRAPH_NODES, GRAPH_EDGES, "T", "S");
    expect(unreachable.pathLength).toBe(-1);
    expect(unreachable.path).toEqual([]);
  });
});
