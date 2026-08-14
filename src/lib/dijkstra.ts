// Plain Dijkstra on a small fixed directed graph — no heuristic, no weight
// dial. f collapses to g; the min-heap always pops the lowest known cost.
// See src/lib/example-graph.ts for the graph this runs on.

export type NodeId = string;

export type GraphNode = { id: NodeId; label: string; x: number; y: number };
export type GraphEdge = { id: string; from: NodeId; to: NodeId; weight: number };

export type NeighborStatus = "closed" | "relaxed" | "skipped";

/** What happened when the popped node's loop considered one outgoing edge. */
export type NeighborTrace = {
  edgeId: string;
  nodeId: NodeId;
  status: NeighborStatus;
  tentativeG: number;
};

/** One pop-and-expand iteration of the main loop, for the step-by-step walkthrough. */
export type SearchStep = {
  nodeId: NodeId;
  g: number;
  /** Empty when `nodeId` is the end (the loop breaks before expanding it). */
  neighbors: NeighborTrace[];
};

export type SearchResult = {
  /** Nodes in the order they were finalized (popped), for the reveal animation. */
  visitedOrder: NodeId[];
  /** Start-to-end nodes of the found route, or [] if the end is unreachable. */
  path: NodeId[];
  /** Edge ids along `path`, in order. */
  pathEdgeIds: string[];
  expandedCount: number;
  /** Sum of edge weights along the path; -1 if unreachable. */
  pathLength: number;
  /** One entry per popped node, same order as visitedOrder. */
  steps: SearchStep[];
};

type HeapEntry = { g: number; seq: number; nodeId: NodeId };

/** Binary min-heap keyed on g, insertion order (`seq`) as the tiebreak. */
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
    return a.g < b.g || (a.g === b.g && a.seq < b.seq);
  }
}

/** Directed Dijkstra over a small explicit node/edge list. */
export function search(nodes: GraphNode[], edges: GraphEdge[], start: NodeId, end: NodeId): SearchResult {
  const outgoing = new Map<NodeId, GraphEdge[]>();
  for (const node of nodes) outgoing.set(node.id, []);
  for (const edge of edges) outgoing.get(edge.from)?.push(edge);

  const visitedOrder: NodeId[] = [];
  const steps: SearchStep[] = [];
  const bestG = new Map<NodeId, number>();
  const parent = new Map<NodeId, { nodeId: NodeId | null; edgeId: string | null }>();
  const closed = new Set<NodeId>();
  const heap = new MinHeap();
  let seq = 0;

  bestG.set(start, 0);
  parent.set(start, { nodeId: null, edgeId: null });
  heap.push({ g: 0, seq: seq++, nodeId: start });

  let reachedEnd = false;

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    if (closed.has(current.nodeId)) continue;
    if ((bestG.get(current.nodeId) ?? Infinity) < current.g) continue;

    closed.add(current.nodeId);
    visitedOrder.push(current.nodeId);

    const step: SearchStep = { nodeId: current.nodeId, g: current.g, neighbors: [] };
    steps.push(step);

    if (current.nodeId === end) {
      reachedEnd = true;
      break;
    }

    for (const edge of outgoing.get(current.nodeId) ?? []) {
      if (closed.has(edge.to)) {
        step.neighbors.push({ edgeId: edge.id, nodeId: edge.to, status: "closed", tentativeG: current.g + edge.weight });
        continue;
      }
      const tentativeG = current.g + edge.weight;
      if (tentativeG < (bestG.get(edge.to) ?? Infinity)) {
        bestG.set(edge.to, tentativeG);
        parent.set(edge.to, { nodeId: current.nodeId, edgeId: edge.id });
        heap.push({ g: tentativeG, seq: seq++, nodeId: edge.to });
        step.neighbors.push({ edgeId: edge.id, nodeId: edge.to, status: "relaxed", tentativeG });
      } else {
        step.neighbors.push({ edgeId: edge.id, nodeId: edge.to, status: "skipped", tentativeG });
      }
    }
  }

  const path: NodeId[] = [];
  const pathEdgeIds: string[] = [];
  if (reachedEnd) {
    let cursor: NodeId | null = end;
    while (cursor !== null) {
      path.unshift(cursor);
      const link = parent.get(cursor);
      if (link?.edgeId) pathEdgeIds.unshift(link.edgeId);
      cursor = link?.nodeId ?? null;
    }
  }

  return {
    visitedOrder,
    path,
    pathEdgeIds,
    expandedCount: visitedOrder.length,
    pathLength: reachedEnd ? (bestG.get(end) ?? -1) : -1,
    steps,
  };
}
