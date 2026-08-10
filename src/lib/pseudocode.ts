// Mirrors src/lib/astar.ts's actual loop structure line-for-line, so the
// panel is describing the real search, not a simplified stand-in. Stays
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
  { line: 7, text: "    if neighbor is a wall or already closed: skip" },
  { line: 8, text: "    tentative_g ← g[current] + 1" },
  { line: 9, text: "    if tentative_g < g[neighbor]: update g, f, and open" },
  { line: 10, text: "reconstruct path by following parent pointers from end" },
  { line: 11, text: "return path (or \"no path\" if end was never reached)" },
];

export const PHASE_LINES = {
  loopPop: [3, 4, 5],
  loopExpand: [6, 7, 8, 9],
  reconstruct: [10],
  done: [11],
} as const;

export type PseudoPhase = keyof typeof PHASE_LINES;
