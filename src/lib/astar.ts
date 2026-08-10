// One weighted search underlies Dijkstra (weight 0), A* (weight 1), and
// greedy best-first (weight > 1) — f = g + weight * h, lowest f expands
// first. See PLAN.md for why that's the point of the whole site: at
// weight > 1 the heuristic is no longer admissible, and the search can
// return a path that isn't actually shortest.

export type Coord = { row: number; col: number };

export type SearchResult = {
  /** Cells in the order they were finalized (expanded), for the reveal animation. */
  visitedOrder: Coord[];
  /** Start-to-end cells of the found route, or [] if the end is unreachable. */
  path: Coord[];
  expandedCount: number;
  /** Number of steps in `path` (edges, not cells); -1 if unreachable. */
  pathLength: number;
};

function key(c: Coord): string {
  return `${c.row},${c.col}`;
}

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

const DIRECTIONS: Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

type HeapEntry = { f: number; seq: number; row: number; col: number; g: number };

/** Binary min-heap keyed on f, insertion order (`seq`) as the tiebreak. */
class MinHeap {
  private items: HeapEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: HeapEntry): void {
    this.items.push(entry);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.isBetter(this.items[i], this.items[parent])) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  pop(): HeapEntry | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (last !== undefined && this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < this.items.length && this.isBetter(this.items[left], this.items[smallest])) smallest = left;
        if (right < this.items.length && this.isBetter(this.items[right], this.items[smallest])) smallest = right;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top;
  }

  private isBetter(a: HeapEntry, b: HeapEntry): boolean {
    return a.f < b.f || (a.f === b.f && a.seq < b.seq);
  }
}

/**
 * Weighted grid search. `walls[row][col] === true` means blocked. 4-directional
 * moves, unit cost, Manhattan heuristic. `weight` 0 = Dijkstra, 1 = A*,
 * >1 = greedy best-first (fast, no longer guaranteed shortest).
 */
export function search(walls: boolean[][], start: Coord, end: Coord, weight: number): SearchResult {
  const rows = walls.length;
  const cols = rows > 0 ? walls[0].length : 0;
  const inBounds = (c: Coord) => c.row >= 0 && c.row < rows && c.col >= 0 && c.col < cols;

  const visitedOrder: Coord[] = [];
  const bestG = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const closed = new Set<string>();
  const heap = new MinHeap();
  let seq = 0;

  bestG.set(key(start), 0);
  parent.set(key(start), null);
  heap.push({ f: weight * manhattan(start, end), seq: seq++, row: start.row, col: start.col, g: 0 });

  let reachedEnd = false;

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    const currentCoord = { row: current.row, col: current.col };
    const currentKey = key(currentCoord);
    if (closed.has(currentKey)) continue;
    if ((bestG.get(currentKey) ?? Infinity) < current.g) continue;

    closed.add(currentKey);
    visitedOrder.push(currentCoord);

    if (currentCoord.row === end.row && currentCoord.col === end.col) {
      reachedEnd = true;
      break;
    }

    for (const dir of DIRECTIONS) {
      const next = { row: current.row + dir.row, col: current.col + dir.col };
      if (!inBounds(next) || walls[next.row][next.col]) continue;
      const nextKey = key(next);
      if (closed.has(nextKey)) continue;
      const tentativeG = current.g + 1;
      if (tentativeG < (bestG.get(nextKey) ?? Infinity)) {
        bestG.set(nextKey, tentativeG);
        parent.set(nextKey, currentKey);
        heap.push({ f: tentativeG + weight * manhattan(next, end), seq: seq++, row: next.row, col: next.col, g: tentativeG });
      }
    }
  }

  const path: Coord[] = [];
  if (reachedEnd) {
    let cursorKey: string | null = key(end);
    while (cursorKey !== null) {
      const [rowStr, colStr] = cursorKey.split(",");
      path.unshift({ row: Number(rowStr), col: Number(colStr) });
      cursorKey = parent.get(cursorKey) ?? null;
    }
  }

  return {
    visitedOrder,
    path,
    expandedCount: visitedOrder.length,
    pathLength: reachedEnd ? path.length - 1 : -1,
  };
}
