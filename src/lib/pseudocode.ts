// Mirrors src/lib/graph-search.ts's actual loop structure line-for-line, so
// the panel is describing the real search, not a simplified stand-in. Stays
// generic across weight 0/1/>1 — the dial only changes what `weight` is,
// never which lines run — matching the "one dial, three pathfinders" idea.

export type PseudoLine = { line: number; text: string };

export const PSEUDOCODE_LINES: PseudoLine[] = [
  { line: 1, text: "open ← {start}; g[start] ← 0" },
  { line: 2, text: "while open is not empty:" },
  { line: 3, text: "  current ← node in open with lowest f = g + weight×h" },
  { line: 4, text: "  if current = end: break" },
  { line: 5, text: "  move current from open to closed" },
  { line: 6, text: "  for each neighbor of current:" },
  { line: 7, text: "    if the edge to neighbor is blocked or neighbor already closed: skip" },
  { line: 8, text: "    tentative_g ← g[current] + cost of the edge to neighbor" },
  { line: 9, text: "    if tentative_g < g[neighbor]: update g, f, and open" },
  { line: 10, text: "reconstruct path by following parent pointers from end" },
  { line: 11, text: "return path (or \"no path\" if end was never reached)" },
];

export const PHASE_LINES = {
  /** Before the first step: only line 1 (g[start] ← 0) has happened. */
  start: [1],
  /** One click = one full pop-and-expand iteration (lines 3-9 together). */
  popAndExpand: [3, 4, 5, 6, 7, 8, 9],
  /** The terminal step where current = end: breaks before the neighbor loop. */
  loopPop: [3, 4, 5],
  /** Final step: reconstruct the path and return it. */
  finish: [10, 11],
} as const;

export type PseudoPhase = keyof typeof PHASE_LINES;
