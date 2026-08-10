import type { Coord } from "./astar.ts";

export const GRID_ROWS = 10;
export const GRID_COLS = 16;

export const DEFAULT_START: Coord = { row: 5, col: 1 };
export const DEFAULT_END: Coord = { row: 5, col: 14 };

export function createEmptyWalls(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => false));
}

/**
 * Hand-built so weight > ~2.5 provably returns a longer-than-optimal path
 * (verified in astar.test.ts, not just eyeballed): a barrier at column 6 has
 * two gaps, one closer to the start's row (row 8) and one farther (row 1). A
 * second barrier at column 10 has a gap ONLY at row 1. The closer gap looks
 * more attractive step-by-step — smaller heuristic each move — so a highly
 * weighted search commits to it, only to hit the second barrier's wall and
 * have to climb all the way back up to row 1 anyway. Dijkstra and true A*
 * explore enough to see that the direct route through row 1 both times
 * (length 21) beats the lure-then-backtrack route (length 27).
 */
export function createTrapMaze(): boolean[][] {
  const walls = createEmptyWalls();
  for (let row = 0; row < GRID_ROWS; row++) {
    if (row !== 1 && row !== 8) walls[row][6] = true;
    if (row !== 1) walls[row][10] = true;
  }
  return walls;
}
