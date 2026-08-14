// A fixed 7-node directed graph, hand-placed (no runtime layout algorithm) so
// the SVG coordinates below are exactly what viewers see. Traced by hand:
// Dijkstra pops S, A, B, C, D, E, T in that order; B is relaxed 5->3 via A,
// D is relaxed 9->7 via B, and D/E tie at g=7 with insertion order picking D
// first — the walkthrough exists to make that tiebreak visible, not just the
// final path. Shortest path S->A->B->D->T, total weight 8.

import type { GraphEdge, GraphNode } from "./dijkstra.ts";

export const START_ID = "S";
export const END_ID = "T";

export const GRAPH_VIEWBOX = { width: 800, height: 450 };

export const GRAPH_NODES: GraphNode[] = [
  { id: "S", label: "S", x: 80, y: 225 },
  { id: "A", label: "A", x: 280, y: 90 },
  { id: "B", label: "B", x: 280, y: 225 },
  { id: "C", label: "C", x: 280, y: 360 },
  { id: "D", label: "D", x: 520, y: 140 },
  { id: "E", label: "E", x: 520, y: 310 },
  { id: "T", label: "T", x: 720, y: 225 },
];

export const GRAPH_EDGES: GraphEdge[] = [
  { id: "S-A", from: "S", to: "A", weight: 2 },
  { id: "S-B", from: "S", to: "B", weight: 5 },
  { id: "S-C", from: "S", to: "C", weight: 4 },
  { id: "A-B", from: "A", to: "B", weight: 1 },
  { id: "A-D", from: "A", to: "D", weight: 7 },
  { id: "B-C", from: "B", to: "C", weight: 2 },
  { id: "B-D", from: "B", to: "D", weight: 4 },
  { id: "C-E", from: "C", to: "E", weight: 3 },
  { id: "D-T", from: "D", to: "T", weight: 1 },
  { id: "E-D", from: "E", to: "D", weight: 1 },
  { id: "E-T", from: "E", to: "T", weight: 5 },
];
