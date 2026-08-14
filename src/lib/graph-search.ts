// One weighted search underlies Dijkstra (weight 0), A* (weight 1), and
// greedy best-first (weight > 1) — f = g + weight * h, lowest f expands
// first. See PLAN.md for why that's the point of the whole site: at
// weight > 1 the heuristic is no longer admissible, and the search can
// return a path that isn't actually shortest.

export type GraphNode = { id: string; label: string; x: number; y: number };
export type GraphEdge = { id: string; a: string; b: string; weight: number };

export type NeighborStatus = "blocked" | "closed" | "relaxed" | "skipped";

/** What happened when the popped node's loop considered one neighbor. */
export type NeighborTrace = {
  nodeId: string;
  status: NeighborStatus;
  /** g/f the neighbor would get if relaxed; null for "blocked" (no cost to relax to). */
  tentativeG: number | null;
  f: number | null;
};

/** One pop-and-expand iteration of the main loop, for the step-by-step walkthrough. */
export type SearchStep = {
  nodeId: string;
  g: number;
  h: number;
  f: number;
  /** Empty when `nodeId` is the end (the loop breaks before expanding it). */
  neighbors: NeighborTrace[];
};

export type SearchResult = {
  /** Node ids in the order they were finalized (expanded), for the reveal animation. */
  visitedOrder: string[];
  /** Start-to-end node ids of the found route, or [] if the end is unreachable. */
  path: string[];
  expandedCount: number;
  /** Total edge weight along `path`; -1 if unreachable. */
  pathLength: number;
  /** One entry per popped node, same order as visitedOrder. */
  steps: SearchStep[];
};

/** Straight-line distance — admissible as long as every edge weighs at least as much as the line between its ends. */
export function euclidean(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

type HeapEntry = { f: number; seq: number; nodeId: string; g: number };

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
 * Weighted graph search. Edges are undirected; an id in `blockedEdgeIds` is
 * skipped as a wall would be. Euclidean heuristic, real per-edge cost.
 * `weight` 0 = Dijkstra, 1 = A*, >1 = greedy best-first (fast, no longer
 * guaranteed shortest).
 */
export function search(
  nodes: GraphNode[],
  edges: GraphEdge[],
  blockedEdgeIds: Set<string>,
  start: string,
  end: string,
  weight: number,
): SearchResult {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, { neighborId: string; edgeId: string; weight: number }[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const e of edges) {
    adjacency.get(e.a)?.push({ neighborId: e.b, edgeId: e.id, weight: e.weight });
    adjacency.get(e.b)?.push({ neighborId: e.a, edgeId: e.id, weight: e.weight });
  }

  const endNode = nodeById.get(end);
  const h = (nodeId: string): number => {
    const node = nodeById.get(nodeId);
    return node && endNode ? euclidean(node, endNode) : 0;
  };

  const visitedOrder: string[] = [];
  const steps: SearchStep[] = [];
  const bestG = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const closed = new Set<string>();
  const heap = new MinHeap();
  let seq = 0;

  bestG.set(start, 0);
  parent.set(start, null);
  heap.push({ f: weight * h(start), seq: seq++, nodeId: start, g: 0 });

  let reachedEnd = false;

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    if (closed.has(current.nodeId)) continue;
    if ((bestG.get(current.nodeId) ?? Infinity) < current.g) continue;

    closed.add(current.nodeId);
    visitedOrder.push(current.nodeId);

    const hv = h(current.nodeId);
    const step: SearchStep = { nodeId: current.nodeId, g: current.g, h: hv, f: current.g + weight * hv, neighbors: [] };
    steps.push(step);

    if (current.nodeId === end) {
      reachedEnd = true;
      break;
    }

    for (const { neighborId, edgeId, weight: edgeWeight } of adjacency.get(current.nodeId) ?? []) {
      if (blockedEdgeIds.has(edgeId)) {
        step.neighbors.push({ nodeId: neighborId, status: "blocked", tentativeG: null, f: null });
        continue;
      }
      if (closed.has(neighborId)) {
        step.neighbors.push({ nodeId: neighborId, status: "closed", tentativeG: null, f: null });
        continue;
      }
      const tentativeG = current.g + edgeWeight;
      const neighborF = tentativeG + weight * h(neighborId);
      if (tentativeG < (bestG.get(neighborId) ?? Infinity)) {
        bestG.set(neighborId, tentativeG);
        parent.set(neighborId, current.nodeId);
        heap.push({ f: neighborF, seq: seq++, nodeId: neighborId, g: tentativeG });
        step.neighbors.push({ nodeId: neighborId, status: "relaxed", tentativeG, f: neighborF });
      } else {
        step.neighbors.push({ nodeId: neighborId, status: "skipped", tentativeG, f: neighborF });
      }
    }
  }

  const path: string[] = [];
  if (reachedEnd) {
    let cursor: string | null = end;
    while (cursor !== null) {
      path.unshift(cursor);
      cursor = parent.get(cursor) ?? null;
    }
  }

  return {
    visitedOrder,
    path,
    expandedCount: visitedOrder.length,
    pathLength: reachedEnd ? (steps.at(-1)?.g ?? -1) : -1,
    steps,
  };
}
