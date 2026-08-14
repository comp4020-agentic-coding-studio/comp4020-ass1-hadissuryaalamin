import type { GraphEdge, GraphNode } from "./graph-search.ts";

/** Canonical undirected edge id — same id regardless of which end is named first. */
export function edgeId(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function edge(a: string, b: string, weight: number): GraphEdge {
  return { id: edgeId(a, b), a, b, weight };
}

export type ExampleGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  start: string;
  end: string;
};

/**
 * The default example: six nodes, no blocked edges needed to demonstrate the
 * search — every weight (Dijkstra through greedy) finds the same true
 * shortest route, the same way the original empty grid did.
 */
export function createOpenGraph(): ExampleGraph {
  const nodes: GraphNode[] = [
    { id: "A", label: "A", x: 0, y: 3 },
    { id: "B", label: "B", x: 2, y: 0 },
    { id: "C", label: "C", x: 2, y: 6 },
    { id: "D", label: "D", x: 4, y: 3 },
    { id: "E", label: "E", x: 6, y: 0 },
    { id: "F", label: "F", x: 8, y: 3 },
  ];
  const edges: GraphEdge[] = [
    edge("A", "B", 4),
    edge("A", "C", 4),
    edge("B", "D", 4),
    edge("C", "D", 4),
    edge("D", "E", 4),
    edge("D", "F", 5),
    edge("E", "F", 4),
  ];
  return { nodes, edges, start: "A", end: "F" };
}

/**
 * The trap example: B sits almost on the straight line to D, so its low
 * heuristic lures greedy search (weight > 1) into closing it first — but the
 * B-D edge is expensive, so the route through B costs more overall than the
 * true shortest route through C. Weight 0/1 aren't fooled; weight > 1 is.
 */
export function createTrapGraph(): ExampleGraph {
  const nodes: GraphNode[] = [
    { id: "A", label: "A", x: 0, y: 3 },
    { id: "B", label: "B", x: 5, y: 3.2 },
    { id: "C", label: "C", x: 2, y: 7 },
    { id: "D", label: "D", x: 10, y: 3 },
  ];
  const edges: GraphEdge[] = [edge("A", "B", 6), edge("B", "D", 9), edge("A", "C", 5), edge("C", "D", 9)];
  return { nodes, edges, start: "A", end: "D" };
}

export const DEFAULT_START = "A";
export const DEFAULT_END = "F";
